/**
 * DeepSeek Harness Desktop - Main Process (Seamless Edge-to-Edge Edition)
 * Zero extra top bar, full-bleed window, natural sidebar breathing room, white-base black-whale icon, in-app updater.
 */

const { app, BrowserWindow, Menu, Tray, nativeImage, dialog, globalShortcut, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, exec } = require('child_process');

// Configuration
const HARNESS_REPO_DIR = '/Users/miaoqian/Documents/Codex/2026-08-15/https-github-com-deepseek-ai-deepseek/deepseek-harness';
const DEFAULT_PORT = 3080;
const SERVER_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

let mainWindow = null;
let splashWindow = null;
let tray = null;
let serverProcess = null;
let isQuitting = false;
let serverReady = false;
let currentWorkspace = HARNESS_REPO_DIR;

// ── 1. HTTP Health Check ───────────────────────────────────────────────────

function checkServerReady(url, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
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

async function waitForServer(url, maxRetries = 40, intervalMs = 700) {
  for (let i = 0; i < maxRetries; i++) {
    const ready = await checkServerReady(url);
    if (ready) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

// ── 2. Server Process Management ───────────────────────────────────────────

function startHarnessServer() {
  console.log('[Desktop Host] Launching DeepSeek Harness engine...');

  const env = {
    ...process.env,
    PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ''}`
  };

  try {
    serverProcess = spawn('pnpm', ['dsh', 'web', '--port', String(DEFAULT_PORT)], {
      cwd: currentWorkspace,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`[Harness] ${data.toString().trim()}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.warn(`[Harness] ${data.toString().trim()}`);
    });

    serverProcess.on('exit', (code, signal) => {
      console.log(`[Harness] Process exited (code=${code}, signal=${signal})`);
      serverProcess = null;
      serverReady = false;
      updateTrayMenu();
    });
  } catch (err) {
    console.error('[Desktop Host] Failed to spawn server:', err);
  }
}

function stopHarnessServer() {
  if (serverProcess && serverProcess.pid) {
    console.log('[Desktop Host] Stopping Harness background engine...');
    const pid = serverProcess.pid;
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {}
    }
    exec(`lsof -ti:${DEFAULT_PORT} | xargs kill -9 2>/dev/null || true`);
  }
}

// ── 3. Window Creation ─────────────────────────────────────────────────────

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
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 640,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
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

      // Inject Auto-Updater UI functions (Zero extra top bars)
      const clientScript = `
        (function() {
          window.__dshCheckAndShowUpdate = async function(silent = true) {
            if (!window.desktopBridge || !window.desktopBridge.checkUpdate) return;
            try {
              const res = await window.desktopBridge.checkUpdate();
              if (res && res.hasUpdate) {
                showUpdateToast(res.aheadCount);
              } else if (!silent) {
                alert('当前已是最新版本！所有官方插件均为最新状态。');
              }
            } catch (e) {
              if (!silent) alert('检查更新失败，请检查网络连接。');
            }
          };

          function showUpdateToast(count) {
            if (document.getElementById('dsh-update-toast')) return;
            const toast = document.createElement('div');
            toast.id = 'dsh-update-toast';
            toast.innerHTML = \`
              <div class="dsh-toast-top">
                <div class="dsh-toast-title">
                  <span>✨ 发现官方新版本与插件更新</span>
                </div>
                <button class="dsh-toast-close" id="dsh-close-toast">×</button>
              </div>
              <div class="dsh-toast-desc">
                检测到 DeepSeek Harness 官方发布了新功能与插件优化（共 \${count || 1} 个更新），支持一键无缝热升级。
              </div>
              <div class="dsh-toast-actions">
                <button class="dsh-btn-dismiss" id="dsh-btn-dismiss">稍后</button>
                <button class="dsh-btn-update" id="dsh-btn-do-update">🚀 立即一键更新</button>
              </div>
            \`;
            document.body.appendChild(toast);

            document.getElementById('dsh-close-toast')?.addEventListener('click', () => toast.remove());
            document.getElementById('dsh-btn-dismiss')?.addEventListener('click', () => toast.remove());
            document.getElementById('dsh-btn-do-update')?.addEventListener('click', () => {
              toast.remove();
              startInAppUpdate();
            });
          }

          function startInAppUpdate() {
            if (document.getElementById('dsh-modal-overlay')) return;
            const modal = document.createElement('div');
            modal.id = 'dsh-modal-overlay';
            modal.innerHTML = \`
              <div class="dsh-modal-card">
                <div class="dsh-modal-header">
                  <span>🔄 正在同步与更新官方插件...</span>
                </div>
                <div class="dsh-progress-bar-container">
                  <div class="dsh-progress-bar-fill"></div>
                </div>
                <div class="dsh-modal-log" id="dsh-update-log">正在初始化更新通道...\\n</div>
              </div>
            \`;
            document.body.appendChild(modal);

            const logEl = document.getElementById('dsh-update-log');
            if (window.desktopBridge && window.desktopBridge.onUpdateProgress) {
              window.desktopBridge.onUpdateProgress((data) => {
                if (logEl) {
                  logEl.textContent += data + '\\n';
                  logEl.scrollTop = logEl.scrollHeight;
                }
              });
            }

            window.desktopBridge.applyUpdate().then((success) => {
              if (success) {
                if (logEl) logEl.textContent += '🎉 更新完成！正在重载应用...\\n';
                setTimeout(() => window.location.reload(), 1500);
              } else {
                if (logEl) logEl.textContent += '❌ 更新遇到问题，请重试。\\n';
              }
            });
          }

          // Auto-check silently after 4s
          setTimeout(() => {
            if (window.__dshCheckAndShowUpdate) window.__dshCheckAndShowUpdate(true);
          }, 4000);
        })();
      `;
      mainWindow.webContents.executeJavaScript(clientScript);
    } catch (e) {
      console.warn('[Desktop Host] Injection notice:', e);
    }
  };

  mainWindow.webContents.on('dom-ready', injectDesktopEnhancements);
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

  mainWindow.on('close', (e) => {
    if (!isQuitting && process.platform === 'darwin') {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      if (!url.includes(`127.0.0.1:${DEFAULT_PORT}`) && !url.includes(`localhost:${DEFAULT_PORT}`)) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
    }
    return { action: 'allow' };
  });
}

// ── 4. Auto-Update IPC Handlers ────────────────────────────────────────────

ipcMain.handle('engine:check-update', async () => {
  return new Promise((resolve) => {
    exec('git fetch origin master --depth=5 && git rev-list HEAD..origin/master --count', { cwd: HARNESS_REPO_DIR }, (err, stdout) => {
      if (err) {
        resolve({ hasUpdate: false, aheadCount: 0 });
        return;
      }
      const count = parseInt(stdout.trim(), 10) || 0;
      resolve({ hasUpdate: count > 0, aheadCount: count });
    });
  });
});

ipcMain.handle('engine:apply-update', async (event) => {
  const send = (msg) => {
    if (mainWindow) mainWindow.webContents.send('update:progress', msg);
  };

  return new Promise((resolve) => {
    send('[1/4] 正在拉取官方最新代码与插件 (git pull)...');
    exec('git pull --rebase origin master', { cwd: HARNESS_REPO_DIR }, (err1, out1) => {
      if (err1) {
        send(`拉取错误: ${err1.message}`);
        resolve(false);
        return;
      }
      send(out1.trim());

      send('[2/4] 正在同步安装依赖包 (pnpm install)...');
      exec('pnpm install', { cwd: HARNESS_REPO_DIR }, (err2) => {
        if (err2) {
          send(`依赖同步提示: ${err2.message}`);
        }

        send('[3/4] 正在构建前端与插件 bundle (pnpm run build:web)...');
        exec('pnpm run build:web', { cwd: HARNESS_REPO_DIR }, (err3) => {
          if (err3) {
            send(`构建提示: ${err3.message}`);
          }

          send('[4/4] 正在重启本地 Harness 核心引擎...');
          stopHarnessServer();
          setTimeout(() => {
            startHarnessServer();
            send('✅ 引擎已重启成功！');
            resolve(true);
          }, 1200);
        });
      });
    });
  });
});

// ── 5. Menus & Tray ────────────────────────────────────────────────────────

function createApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac
      ? [
          {
            label: 'DeepSeek Harness',
            submenu: [
              { role: 'about', label: '关于 DeepSeek Harness' },
              {
                label: '检查官方插件更新...',
                click: () => {
                  if (mainWindow) {
                    mainWindow.show();
                    mainWindow.webContents.executeJavaScript('window.__dshCheckAndShowUpdate(false);');
                  }
                }
              },
              { type: 'separator' },
              {
                label: '偏好设置...',
                accelerator: 'Cmd+,',
                click: () => {
                  if (mainWindow) {
                    mainWindow.show();
                    mainWindow.webContents.send('engine:open-settings');
                  }
                }
              },
              { type: 'separator' },
              { role: 'services', label: '服务' },
              { type: 'separator' },
              { role: 'hide', label: '隐藏 DeepSeek Harness' },
              { role: 'hideOthers', label: '隐藏其他' },
              { role: 'unhide', label: '显示全部' },
              { type: 'separator' },
              { role: 'quit', label: '退出 DeepSeek Harness' }
            ]
          }
        ]
      : []),
    {
      label: '文件',
      submenu: [
        {
          label: '打开工作区目录...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory', 'createDirectory'],
              title: '选择 DeepSeek Harness 工作区目录'
            });
            if (!result.canceled && result.filePaths.length > 0) {
              currentWorkspace = result.filePaths[0];
              if (mainWindow) {
                mainWindow.webContents.send('engine:switch-workspace', currentWorkspace);
              }
            }
          }
        },
        {
          label: '重启 Harness 引擎',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: async () => {
            stopHarnessServer();
            setTimeout(() => {
              startHarnessServer();
              if (mainWindow) mainWindow.reload();
            }, 1000);
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: '关闭窗口' } : { role: 'quit', label: '退出' }
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
        { role: 'forceReload', label: '强制刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '默认大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏模式' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front', label: '前置所有窗口' }
            ]
          : [{ role: 'close', label: '关闭' }])
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '检查官方插件更新...',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.webContents.executeJavaScript('window.__dshCheckAndShowUpdate(false);');
            }
          }
        },
        {
          label: 'DeepSeek 官方网站',
          click: async () => shell.openExternal('https://www.deepseek.com')
        },
        {
          label: 'Harness 项目源码与文档',
          click: async () => shell.openExternal('https://github.com/deepseek-ai/deepseek-harness')
        },
        { type: 'separator' },
        {
          label: '在默认浏览器中打开',
          click: async () => shell.openExternal(SERVER_URL)
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function updateTrayMenu() {
  if (!tray) return;

  const statusLabel = serverReady ? '🟢 引擎状态: 运行中 (3080)' : '🟡 引擎状态: 正在连接...';

  const contextMenu = Menu.buildFromTemplate([
    { label: 'DeepSeek Harness 桌面端', enabled: false },
    { label: statusLabel, enabled: false },
    { type: 'separator' },
    {
      label: '显示主窗口',
      accelerator: 'Option+Space',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '检查官方插件更新...',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.executeJavaScript('window.__dshCheckAndShowUpdate(false);');
        }
      }
    },
    {
      label: '打开工作区目录...',
      click: async () => {
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory'],
          title: '选择工作区'
        });
        if (!result.canceled && result.filePaths.length > 0) {
          currentWorkspace = result.filePaths[0];
          if (mainWindow) {
            mainWindow.show();
            mainWindow.webContents.send('engine:switch-workspace', currentWorkspace);
          }
        }
      }
    },
    {
      label: '在默认浏览器中打开',
      click: () => shell.openExternal(SERVER_URL)
    },
    {
      label: '重启本地引擎',
      click: () => {
        stopHarnessServer();
        setTimeout(() => {
          startHarnessServer();
          if (mainWindow) mainWindow.reload();
        }, 1000);
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
    try {
      trayImage = nativeImage.createFromPath(iconPath);
    } catch {
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
    console.warn('[Desktop Host] Tray setup skipped:', e);
  }
}

// ── 6. IPC Handlers ────────────────────────────────────────────────────────

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
  stopHarnessServer();
  await new Promise((r) => setTimeout(r, 1000));
  startHarnessServer();
  return true;
});

// ── 7. App Lifecycle ───────────────────────────────────────────────────────

app.whenReady().then(async () => {
  createApplicationMenu();
  createSplashWindow();
  createTray();

  globalShortcut.register('Option+Space', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  const alreadyRunning = await checkServerReady(SERVER_URL, 500);
  if (alreadyRunning) {
    console.log('[Desktop Host] DeepSeek Harness server is online at', SERVER_URL);
    serverReady = true;
  } else {
    startHarnessServer();
    console.log('[Desktop Host] Waiting for server on', SERVER_URL);
    serverReady = await waitForServer(SERVER_URL, 40, 700);
  }

  if (serverReady) {
    console.log('[Desktop Host] Engine online! Presenting main window.');
    updateTrayMenu();
    createMainWindow();
  } else {
    dialog.showErrorBox(
      'DeepSeek Harness 提示',
      '本地引擎正在启动中，请点击确定稍候片刻或刷新重试。'
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
  stopHarnessServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
