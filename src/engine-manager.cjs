/**
 * Universal Engine Manager for DeepSeek Harness Desktop
 * Cross-Platform (macOS, Windows, Linux) Engine Discovery, Auto-Cloner & Process Supervisor.
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const { app } = require('electron');
const { spawn, exec } = require('child_process');

const OFFICIAL_REPO_URL = 'https://github.com/deepseek-ai/deepseek-harness.git';
const DEFAULT_PORT = 3080;
const SERVER_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

class UniversalEngineManager {
  constructor() {
    this.serverProcess = null;
    this.serverReady = false;
    this.engineDir = this.resolveEngineDirectory();
  }

  // 1. Resolve storage location across macOS / Windows / Linux
  resolveEngineDirectory() {
    if (process.env.HARNESS_DIR && fs.existsSync(process.env.HARNESS_DIR)) {
      return process.env.HARNESS_DIR;
    }
    const os = require('os');
    const homeDir = os.homedir();
    const candidateDevDirs = [
      path.join(homeDir, 'Documents', 'deepseek-harness'),
      path.join(homeDir, '.deepseek-harness'),
      path.join(homeDir, 'deepseek-harness')
    ];
    for (const devDir of candidateDevDirs) {
      if (fs.existsSync(devDir)) return devDir;
    }

    // Check packaged resources directory
    const resourcesEngine = path.join(process.resourcesPath || '', 'engine');
    if (fs.existsSync(resourcesEngine)) {
      return resourcesEngine;
    }

    // Standard User Data directory:
    // macOS: ~/Library/Application Support/DeepSeek Harness/engine
    // Windows: %APPDATA%/DeepSeek Harness/engine
    // Linux: ~/.config/DeepSeek Harness/engine
    const userDataPath = app.getPath('userData');
    const autoEngineDir = path.join(userDataPath, 'engine');
    return autoEngineDir;
  }

  // 2. Health check HTTP port
  checkServerReady(timeoutMs = 1200) {
    return new Promise((resolve) => {
      const req = http.get(SERVER_URL, { timeout: timeoutMs }, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  async waitForServer(maxRetries = 40, intervalMs = 700) {
    for (let i = 0; i < maxRetries; i++) {
      const ready = await this.checkServerReady();
      if (ready) {
        this.serverReady = true;
        return true;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return false;
  }

  // 3. Auto-Provision Engine from GitHub if missing
  async ensureEngineInstalled(onProgress = () => {}) {
    if (fs.existsSync(path.join(this.engineDir, 'package.json'))) {
      return true;
    }

    fs.mkdirSync(this.engineDir, { recursive: true });
    onProgress('正在从官方 GitHub 克隆 DeepSeek Harness 核心引擎...');

    const isWin = process.platform === 'win32';
    const gitCmd = `git clone --depth=1 ${OFFICIAL_REPO_URL} "${this.engineDir}"`;

    await new Promise((resolve, reject) => {
      exec(gitCmd, (err, stdout, stderr) => {
        if (err) {
          console.error('[Engine Manager] Clone failed:', err, stderr);
          reject(err);
        } else {
          resolve(stdout);
        }
      });
    });

    onProgress('正在安装官方依赖与插件环境 (pnpm install)...');
    const pnpmBin = isWin ? 'pnpm.cmd' : 'pnpm';
    const npmBin = isWin ? 'npm.cmd' : 'npm';
    const installCmd = `${pnpmBin} install || ${npmBin} install`;

    await new Promise((resolve) => {
      exec(installCmd, { cwd: this.engineDir }, (err, stdout) => {
        resolve(stdout);
      });
    });

    onProgress('引擎准备就绪！');
    return true;
  }

  // 4. Cross-Platform Process Spawning
  startServer() {
    console.log('[Engine Manager] Starting Harness server at', this.engineDir);
    const isWin = process.platform === 'win32';

    const env = {
      ...process.env,
      PATH: isWin
        ? `${process.env.PATH};C:\\Program Files\\nodejs;C:\\Program Files\\Git\\bin`
        : `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ''}`
    };

    const cmd = isWin ? 'pnpm.cmd' : 'pnpm';
    const args = ['dsh', 'web', '--port', String(DEFAULT_PORT)];

    try {
      this.serverProcess = spawn(cmd, args, {
        cwd: this.engineDir,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: !isWin,
        shell: isWin
      });

      this.serverProcess.stdout.on('data', (data) => {
        console.log(`[Harness] ${data.toString().trim()}`);
      });

      this.serverProcess.stderr.on('data', (data) => {
        console.warn(`[Harness] ${data.toString().trim()}`);
      });

      this.serverProcess.on('exit', (code, signal) => {
        console.log(`[Harness] Process exited (code=${code}, signal=${signal})`);
        this.serverProcess = null;
        this.serverReady = false;
      });
    } catch (err) {
      console.error('[Engine Manager] Launch error:', err);
    }
  }

  stopServer() {
    if (this.serverProcess && this.serverProcess.pid) {
      const pid = this.serverProcess.pid;
      const isWin = process.platform === 'win32';

      if (isWin) {
        exec(`taskkill /pid ${pid} /T /F 2>nul`);
      } else {
        try {
          process.kill(-pid, 'SIGTERM');
        } catch {
          try {
            process.kill(pid, 'SIGTERM');
          } catch {}
        }
        exec(`lsof -ti:${DEFAULT_PORT} | xargs kill -9 2>/dev/null || true`);
      }
      this.serverProcess = null;
    }
  }
}

module.exports = UniversalEngineManager;
