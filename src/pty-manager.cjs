/**
 * PTY Manager — spawns the DeepSeek Harness TUI (`dsh --profile tui`) inside a
 * pseudo-terminal and bridges its stdio to the Electron renderer's xterm.js.
 *
 * Replaces the old background `pnpm dsh web` server: instead of serving a web
 * UI on port 3080 and loading it in a BrowserWindow, we run the official
 * engine's terminal surface directly inside a real PTY. The whole agent
 * capability set (agent-loop, tools, session, sandbox, subagents, skills)
 * comes from the official `@deepseek-ai/dsh-base` bundle — nothing is forked.
 */

const { spawn, execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// node-pty is a native module; rebuild for Electron with `npm run rebuild`.
let pty;
try {
  pty = require('node-pty');
} catch (err) {
  // Defer the hard failure to start(): a clearer message is emitted there.
  pty = null;
}

const os = require('node:os');
const homeDir = os.homedir();
const DEFAULT_ENGINE_DIR = process.env.HARNESS_DIR || (
  fs.existsSync(path.join(homeDir, 'Documents', 'deepseek-harness'))
    ? path.join(homeDir, 'Documents', 'deepseek-harness')
    : path.join(homeDir, '.deepseek-harness')
);
const OFFICIAL_REPO_URL = 'https://github.com/deepseek-ai/deepseek-harness.git';
const TUI_PROFILE = 'tui';
const TUI_BUNDLE = '@dsh-tui/dsh-tui';

class PtyManager {
  constructor() {
    this.proc = null;
    this.engineDir = fs.existsSync(DEFAULT_ENGINE_DIR) ? DEFAULT_ENGINE_DIR : this.resolveDefaultEngineDir();
    this.dataListeners = new Set();
    this.exitListeners = new Set();
  }

  /**
   * Where to keep the official engine when the developer's local checkout is
   * absent (e.g. on another user's machine after they install this app).
   * macOS: ~/Library/Application Support/DeepSeek Harness/engine
   */
  resolveDefaultEngineDir() {
    const home = process.env.HOME || process.env.USERPROFILE || os.homedir() || '/tmp';
    const appSupport = path.join(home, 'Library', 'Application Support', 'DeepSeek Harness');
    return path.join(appSupport, 'engine');
  }

  /**
   * Resolve pnpm binary path the same way the old host did, so a packaged
   * app without pnpm on PATH can still launch.
   */
  resolvePnpm() {
    const home = process.env.HOME || os.homedir() || '';
    const candidates = [
      '/opt/homebrew/bin/pnpm',
      '/usr/local/bin/pnpm',
      path.join(home, '.local/bin/pnpm')
    ];
    for (const c of candidates) if (fs.existsSync(c)) return c;
    return 'pnpm';
  }

  /**
   * Build a sane environment for the TUI: keep the inherited env, make sure
   * Homebrew / common tool dirs are on PATH (the TUI agent runs shell tools).
   */
  buildEnv() {
    const env = { ...process.env };
    const extra = [
      '/opt/homebrew/bin', '/opt/homebrew/sbin',
      '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin',
      path.join(homeDir, '.local/bin')
    ];
    const parts = (env.PATH || '').split(':');
    for (const p of extra) if (fs.existsSync(p) && !parts.includes(p)) parts.unshift(p);
    env.PATH = parts.join(':');
    // A real terminal identity so the TUI's termcap / color detection works.
    env.TERM = env.TERM || 'xterm-256color';
    env.COLORTERM = env.COLORTERM || 'truecolor';
    env.LANG = env.LANG || 'en_US.UTF-8';
    return env;
  }

  /**
   * Ensure the official engine is present (clone if missing) and that the
   * tui profile has the TUI bundle installed. This is what makes the packaged
   * app self-sufficient on a fresh machine. Returns true on success.
   */
  ensureEngine(onProgress = () => {}) {
    const hasEngine = fs.existsSync(path.join(this.engineDir, 'package.json'));
    if (!hasEngine) {
      onProgress('未检测到官方引擎，正在从 GitHub 克隆 DeepSeek Harness...');
      try {
        fs.mkdirSync(this.engineDir, { recursive: true });
        execSync(`git clone --depth=1 ${OFFICIAL_REPO_URL} "${this.engineDir}"`, {
          stdio: 'pipe', timeout: 120000
        });
      } catch (e) {
        onProgress(`引擎克隆失败: ${e.message}`);
        return false;
      }
      onProgress('正在安装引擎依赖 (pnpm install)...');
      try {
        execSync(`${this.resolvePnpm()} install --no-frozen-lockfile`, {
          cwd: this.engineDir, stdio: 'pipe', timeout: 300000
        });
      } catch (e) {
        onProgress(`依赖安装失败: ${e.message}`);
        return false;
      }
    }

    // Make sure the TUI profile exists with the TUI bundle.
    const tuiProfileDir = path.join(process.env.HOME || '/tmp', '.dsh', 'profiles', TUI_PROFILE);
    const hasTuiBundle = fs.existsSync(path.join(tuiProfileDir, 'package.json')) &&
      this._bundleListHas(tuiProfileDir, TUI_BUNDLE);
    if (!hasTuiBundle) {
      onProgress('正在安装终端 Agent 界面 (@dsh-tui/dsh-tui)...');
      try {
        execSync(`${this.resolvePnpm()} dsh plugin --profile ${TUI_PROFILE} add ${TUI_BUNDLE}`, {
          cwd: this.engineDir, stdio: 'pipe', timeout: 180000
        });
      } catch (e) {
        onProgress(`TUI 安装失败: ${e.message}`);
        return false;
      }
    }
    onProgress('引擎就绪。');
    return true;
  }

  _bundleListHas(profileDir, bundle) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(profileDir, 'package.json'), 'utf8'));
      const bundles = pkg && pkg.dsh && pkg.dsh.profile && pkg.dsh.profile.bundles;
      return Array.isArray(bundles) && bundles.includes(bundle);
    } catch (e) {
      return false;
    }
  }

  /**
   * Start the TUI in a PTY. Returns true on success.
   * @param {object} [opts]
   * @param {string} [opts.cwd] - working directory / workspace for the agent.
   * @param {string} [opts.resume] - optional session id to resume.
   * @param {function} [opts.onProgress] - engine provisioning progress.
   */
  start(opts = {}) {
    if (!pty) {
      this._emitData('\x1b[31m[node-pty 未加载] 请先运行 `npm install` 再 `npm run rebuild` 为 Electron 重新编译 node-pty。\x1b[0m\r\n');
      return false;
    }
    if (this.proc) this.stop();

    // Self-provision the engine + TUI on a fresh machine before spawning.
    if (!this.ensureEngine(opts.onProgress || (() => {}))) {
      this._emitData('\x1b[31m[引擎准备失败] 请检查网络连接后重试，或手动安装 DeepSeek Harness 引擎。\x1b[0m\r\n');
      return false;
    }

    const cwd = (opts.cwd && fs.existsSync(opts.cwd)) ? opts.cwd : this.engineDir;
    const args = ['dsh', '--profile', TUI_PROFILE];
    if (opts.resume) args.push('--resume', opts.resume);

    try {
      this.proc = pty.spawn(this.resolvePnpm(), args, {
        name: 'xterm-256color',
        cols: 100,
        rows: 30,
        cwd,
        env: this.buildEnv()
      });
    } catch (err) {
      this._emitData(`\x1b[31m[启动失败] ${err.message}\x1b[0m\r\n`);
      return false;
    }

    this.proc.onData((data) => {
      for (const fn of this.dataListeners) fn(data);
    });
    this.proc.onExit(({ exitCode, signal }) => {
      for (const fn of this.exitListeners) fn({ exitCode, signal });
      this.proc = null;
    });
    return true;
  }

  /** Forward renderer keystrokes to the PTY. */
  write(data) {
    if (this.proc) {
      try { this.proc.write(data); } catch (e) {}
    }
  }

  /** Notify the PTY of a new terminal size (cols/rows). */
  resize(cols, rows) {
    if (this.proc && cols > 0 && rows > 0) {
      try { this.proc.resize(cols, rows); } catch (e) {}
    }
  }

  /** Stop the running TUI process. */
  stop() {
    if (this.proc) {
      try { this.proc.kill(); } catch (e) {}
      this.proc = null;
    }
  }

  /** Is a TUI process currently running? */
  isRunning() {
    return this.proc !== null;
  }

  onData(fn) { this.dataListeners.add(fn); }
  offData(fn) { this.dataListeners.delete(fn); }
  onExit(fn) { this.exitListeners.add(fn); }
  offExit(fn) { this.exitListeners.delete(fn); }

  _emitData(d) { for (const fn of this.dataListeners) fn(d); }
}

module.exports = { PtyManager };
