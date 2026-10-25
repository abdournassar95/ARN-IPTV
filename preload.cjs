const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('app-version'),
  isFullscreen: () => ipcRenderer.invoke('is-fullscreen'),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
  platform: process.platform,
});
