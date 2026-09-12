/**
 * DeepSeek Harness Desktop - Cross-Platform Native Desktop Application (macOS & Windows)
 * Seamless Agent Workspace, Universal Engine Supervisor & Authentic DeepSeek Experience.
 */

const { app, BrowserWindow, Menu, Tray, nativeImage, dialog, globalShortcut, ipcMain, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const { UniversalEngineManager } = require('./engine-manager.cjs');

// ── 0. Synchronously resolve interactive shell environment on macOS / Linux ──
function resolveEnvironment() {
  if (process.platform === 'win32') {
    const extraWin = [
      path.join(process.env.APPDATA || '', 'npm'),
      path.join(process.env.LOCALAPPDATA || '', 'pnpm'),
      'C:\\Program Files\\nodejs',
      'C:\\Program Files\\Git\\bin'
    ];
    const currentParts = (process.env.PATH || '').split(';');
    for (const p of extraWin) {
      if (fs.existsSync(p) && !currentParts.includes(p)) {
        currentParts.unshift(p);
      }
    }
    process.env.PATH = currentParts.join(';');
    return;
  }

  try {
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
    console.warn('[Desktop Host] Shell env resolution notice:', e.message);
  }

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

// ── Configuration & State ──────────────────────────────────────────────────
const DEFAULT_PORT = 3080;
const SERVER_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

let mainWindow = null;
let splashWindow = null;
let tray = null;
let isQuitting = false;
let serverReady = false;
let engineManager = null;
let currentWorkspace = process.cwd();

// ── 1. Window Creation ─────────────────────────────────────────────────────

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 440,
    height: 400,
    frame: false,
    resizable: false,
    transparent: true,
    show: true,
    center: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

function createMainWindow() {
  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 640,
    title: 'DeepSeek Harness',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 14, y: 14 } : undefined,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: true
    }
  });

  const injectDesktopEnhancements = () => {
    try {
      const cssPath = path.join(__dirname, 'desktop-theme.css');
      if (fs.existsSync(cssPath)) {
        const cssContent = fs.readFileSync(cssPath, 'utf8');
        mainWindow.webContents.insertCSS(cssContent);
      }
    } catch (e) {
      console.warn('[Desktop Host] CSS injection notice:', e.message);
    }
  };

  mainWindow.webContents.on('did-finish-load', injectDesktopEnhancements);
  mainWindow.loadURL(SERVER_URL);

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting && isMac) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// ── 2. Native Application Menu ─────────────────────────────────────────────

function createApplicationMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about', label: '关于 DeepSeek Harness' },
        { type: 'separator' },
        { role: 'services', label: '服务' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏 DeepSeek Harness' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出 DeepSeek Harness' }
      ]
    }] : []),
    {
      label: '工作区',
      submenu: [
        {
          label: '打开工作区目录...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory', 'createDirectory'],
              title: '选择工作区'
            });
            if (!result.canceled && result.filePaths.length > 0) {
              currentWorkspace = result.filePaths[0];
              if (mainWindow) {
                mainWindow.webContents.send('engine:switch-workspace', currentWorkspace);
              }
            }
          }
        },
        { type: 'separator' },
        {
          label: '在系统文件管理器中打开',
          click: () => shell.openPath(currentWorkspace)
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏切换' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front', label: '前置所有窗口' }
        ] : [
          { role: 'close', label: '关闭' }
        ])
      ]
    },
    {
      role: 'help',
      label: '帮助',
      submenu: [
        {
          label: 'DeepSeek Harness GitHub 源码',
          click: () => shell.openExternal('https://github.com/miaoxiaoqian/deepseek-harness-desktop')
        },
        {
          label: 'DeepSeek 官方网站',
          click: () => shell.openExternal('https://www.deepseek.com')
        },
        { type: 'separator' },
        {
          label: '重启本地引擎服务',
          click: async () => {
            if (engineManager) {
              engineManager.stopServer();
              await new Promise((r) => setTimeout(r, 1000));
              engineManager.startServer();
              if (mainWindow) mainWindow.reload();
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ── 3. Tray Icon & Menu ────────────────────────────────────────────────────

function updateTrayMenu() {
  if (!tray) return;

  const shortcutText = process.platform === 'darwin' ? '⌥+Space' : 'Alt+Space';
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `引擎状态: ${serverReady ? '🟢 运行中 (Port ' + DEFAULT_PORT + ')' : '🔴 正在启动/离线'}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: `显示主窗口 (${shortcutText})`,
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '在默认浏览器中打开',
      click: () => shell.openExternal(SERVER_URL)
    },
    {
      label: '重启本地引擎',
      click: async () => {
        if (engineManager) {
          engineManager.stopServer();
          await new Promise((r) => setTimeout(r, 1000));
          engineManager.startServer();
          if (mainWindow) mainWindow.reload();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出 DeepSeek Harness',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('DeepSeek Harness Desktop');
  tray.setContextMenu(contextMenu);
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, '../assets/tray.png');
    let trayImage;
    if (fs.existsSync(iconPath)) {
      trayImage = nativeImage.createFromPath(iconPath);
    } else {
      trayImage = nativeImage.createEmpty();
    }
    tray = new Tray(trayImage);
    updateTrayMenu();

    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      }
    });
  } catch (e) {
    console.warn('[Desktop Host] Tray setup notice:', e.message);
  }
}

// ── 4. Dynamic Dock Icon (macOS) ───────────────────────────────────────────

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
    console.warn('[Desktop Host] Dynamic Dock icon notice:', e.message);
  }
}

// ── 5. IPC Handlers ────────────────────────────────────────────────────────

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: '选择工作区目录'
  });
  if (!result.canceled && result.filePaths.length > 0) {
    currentWorkspace = result.filePaths[0];
    return currentWorkspace;
  }
  return null;
});

ipcMain.handle('engine:status', () => {
  return { ready: serverReady, url: SERVER_URL, port: DEFAULT_PORT, workspace: currentWorkspace };
});

ipcMain.handle('engine:restart', async () => {
  if (engineManager) {
    engineManager.stopServer();
    await new Promise((r) => setTimeout(r, 1000));
    engineManager.startServer();
    return true;
  }
  return false;
});

// ── 6. App Lifecycle & Ready ───────────────────────────────────────────────

app.whenReady().then(async () => {
  updateDynamicDockIcon();
  nativeTheme.on('updated', () => {
    updateDynamicDockIcon();
  });

  createApplicationMenu();
  createSplashWindow();
  createTray();

  const shortcutKey = process.platform === 'darwin' ? 'Option+Space' : 'Alt+Space';
  try {
    globalShortcut.register(shortcutKey, () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible() && mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.warn('[Desktop Host] Global shortcut notice:', err.message);
  }

  engineManager = new UniversalEngineManager();
  currentWorkspace = engineManager.engineDir;

  const alreadyRunning = await engineManager.checkServerReady(500);
  if (alreadyRunning) {
    console.log('[Desktop Host] DeepSeek Harness server is online at', SERVER_URL);
    serverReady = true;
  } else {
    try {
      await engineManager.ensureEngineInstalled((status) => {
        console.log(`[Desktop Host] ${status}`);
        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.webContents.executeJavaScript(`
            const el = document.querySelector('.status-text');
            if (el) el.textContent = ${JSON.stringify(status)};
          `).catch(() => {});
        }
      });
    } catch (err) {
      console.warn('[Desktop Host] Engine install notice:', err.message);
    }

    engineManager.startServer();
    console.log('[Desktop Host] Waiting for server on', SERVER_URL);
    serverReady = await engineManager.waitForServer(60, 800);
  }

  if (serverReady) {
    console.log('[Desktop Host] Engine online! Presenting main window.');
    updateTrayMenu();
    createMainWindow();
  } else {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    dialog.showErrorBox(
      'DeepSeek Harness 提示',
      '本地引擎未能及时响应。请检查网络与环境后重试，或在终端运行 pnpm dsh web 测试。'
    );
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (serverReady) createMainWindow();
      else createSplashWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  if (engineManager) {
    engineManager.stopServer();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
