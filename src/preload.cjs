const { contextBridge, ipcRenderer } = require('electron');

// Terminal bridge: streams the TUI PTY between main and renderer (xterm.js).
contextBridge.exposeInMainWorld('terminalBridge', {
  // PTY -> renderer
  onData: (callback) => ipcRenderer.on('pty:data', (_e, data) => callback(data)),
  onExit: (callback) => ipcRenderer.on('pty:exit', (_e, info) => callback(info)),
  // renderer -> PTY
  write: (data) => ipcRenderer.send('pty:write', data),
  resize: (cols, rows) => ipcRenderer.send('pty:resize', cols, rows),
  // lifecycle
  start: (opts) => ipcRenderer.invoke('pty:start', opts),
  restart: (opts) => ipcRenderer.invoke('pty:restart', opts),
  isRunning: () => ipcRenderer.invoke('pty:is-running'),
  status: () => ipcRenderer.invoke('pty:status')
});

// Legacy desktop bridge (workspace switch, engine update, etc.) — kept for
// the tray menu and auto-updater flows that still talk to the renderer.
contextBridge.exposeInMainWorld('desktopBridge', {
  platform: process.platform,
  version: '0.1.0',
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  getEngineStatus: () => ipcRenderer.invoke('engine:status'),
  restartEngine: () => ipcRenderer.invoke('engine:restart'),
  checkUpdate: () => ipcRenderer.invoke('engine:check-update'),
  applyUpdate: () => ipcRenderer.invoke('engine:apply-update'),
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update:progress', (_event, data) => callback(data));
  },
  onSwitchWorkspace: (callback) => {
    ipcRenderer.on('engine:switch-workspace', (_event, dir) => callback(dir));
  },
  onOpenSettings: (callback) => {
    ipcRenderer.on('engine:open-settings', () => callback());
  }
});
