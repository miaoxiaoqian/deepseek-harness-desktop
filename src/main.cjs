/**
 * DeepSeek Harness Desktop - macOS Application Launcher
 * Boots the native Desktop Agent Workspace (Mode 2) with in-process Cordis runtime.
 */

const path = require('path');
const fs = require('fs');
const { app, nativeImage, nativeTheme } = require('electron');

// 1. Synchronously resolve interactive shell environment on macOS
function resolveEnvironment() {
  if (process.platform === 'win32') return;
  try {
    const { execSync } = require('child_process');
    const raw = execSync('/bin/zsh -ilc "env" 2>/dev/null || /bin/bash -lc "env" 2>/dev/null', {
      timeout: 3000,
      encoding: 'utf8'
    });
    for (const line of raw.split('\n')) {
      const idx = line.indexOf('=');
      if (idx > 0) {
        const k = line.substring(0, idx);
        const v = line.substring(idx + 1);
        if (k && v && !process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  } catch (e) {
    console.warn('[Desktop Launcher] Shell env resolution warning:', e.message);
  }

  const os = require('os');
  const homeDir = os.homedir();
  const extraPaths = [
    path.join(homeDir, '.local/bin'),
    path.join(homeDir, '.antigravity-ide/antigravity-ide/bin'),
    path.join(homeDir, '.gemini/antigravity-cli/bin'),
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin'
  ];
  const currentParts = (process.env.PATH || '').split(':');
  for (const p of extraPaths) {
    if (fs.existsSync(p) && !currentParts.includes(p)) {
      currentParts.unshift(p);
    }
  }
  process.env.PATH = currentParts.join(':');
}

resolveEnvironment();

// 2. Set dynamic Dock Icon
function updateDynamicDockIcon() {
  if (process.platform !== 'darwin' || !app.dock) return;
  try {
    const isDark = nativeTheme.shouldUseDarkColors;
    const iconName = isDark ? 'icon_dark.png' : 'icon_light.png';
    const iconPath = path.join(__dirname, '..', 'assets', iconName);
    let iconImg = null;
    if (fs.existsSync(iconPath)) {
      try {
        const buf = fs.readFileSync(iconPath);
        iconImg = nativeImage.createFromBuffer(buf);
      } catch {
        iconImg = nativeImage.createFromPath(iconPath);
      }
    }
    if (iconImg && !iconImg.isEmpty()) {
      app.dock.setIcon(iconImg);
    }
  } catch (e) {
    console.warn('[Desktop Launcher] Dock icon notice:', e.message);
  }
}

app.whenReady().then(() => {
  updateDynamicDockIcon();
  nativeTheme.on('updated', () => {
    updateDynamicDockIcon();
  });
});

// 3. Resolve and launch native Desktop Agent Workspace Main process
function resolveHarnessMain() {
  const os = require('os');
  const homeDir = os.homedir();
  const candidateDirs = [
    process.env.HARNESS_DIR,
    path.join(homeDir, 'Documents', 'deepseek-harness'),
    path.join(homeDir, '.deepseek-harness'),
    path.join(homeDir, 'deepseek-harness'),
    path.join(app.getPath('userData'), 'engine')
  ].filter(Boolean);

  for (const dir of candidateDirs) {
    const mainJs = path.join(dir, 'apps/desktop/dist/main/index.js');
    const mainCjs = path.join(dir, 'apps/desktop/dist/main/index.cjs');
    if (fs.existsSync(mainJs)) return mainJs;
    if (fs.existsSync(mainCjs)) return mainCjs;
  }
  return null;
}

const DESKTOP_MAIN = resolveHarnessMain();
if (DESKTOP_MAIN && fs.existsSync(DESKTOP_MAIN)) {
  import('file://' + DESKTOP_MAIN).catch((err) => {
    console.error('[Desktop Launcher] Failed to load native desktop main:', err);
  });
} else {
  console.log('[Desktop Launcher] Native desktop main not found at local paths, using Universal Engine Manager...');
  try {
    const { UniversalEngineManager } = require('./engine-manager.cjs');
    const manager = new UniversalEngineManager();
    manager.ensureEngineInstalled().catch((err) => {
      console.warn('[Desktop Launcher] Engine bootstrap notice:', err.message);
    });
  } catch (e) {
    console.warn('[Desktop Launcher] Engine manager fallback notice:', e.message);
  }
}
