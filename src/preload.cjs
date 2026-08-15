const { contextBridge, ipcRenderer } = require('electron');

// Expose safe desktop capabilities to renderer
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
