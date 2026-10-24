'use strict';

/**
 * ARN IPTV Pro — Context-Isolated Preload Bridge
 * Copyright © 2026 عبده رجب نصار — شركة ARN Technology
 *
 * Security Profile: contextIsolation: true | nodeIntegration: false | sandbox: false
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  isElectron: true,

  // System & Status
  getAppStatus: () => ipcRenderer.invoke('get-app-status'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),

  // Playlists & Imports
  loadPlaylists: () => ipcRenderer.invoke('get-playlists'),
  setActivePlaylist: (playlistId) => ipcRenderer.invoke('set-active-playlist', playlistId),
  deletePlaylist: (playlistId) => ipcRenderer.invoke('delete-playlist', playlistId),
  importFgCode: (code) => ipcRenderer.invoke('resolve-fg-code', code),
  importM3uUrl: (payload) => ipcRenderer.invoke('import-m3u-url', payload),
  importM3uText: (payload) => ipcRenderer.invoke('import-m3u-text', payload),
  pickAndImportM3uFile: () => ipcRenderer.invoke('pick-import-m3u-file'),
  importXtream: (payload) => ipcRenderer.invoke('import-xtream', payload),
  seedDemoBouquet: () => ipcRenderer.invoke('seed-demo-bouquet'),
  run50kBenchmark: (count) => ipcRenderer.invoke('run-50k-benchmark', count),

  // Categories, Channels, Favorites & History
  getCategories: (params) => ipcRenderer.invoke('get-categories', params),
  getChannels: (filter) => ipcRenderer.invoke('get-channels', filter),
  getChannelById: (channelId) => ipcRenderer.invoke('get-channel-by-id', channelId),
  toggleFavorite: (channelId, isFav) => ipcRenderer.invoke('toggle-fav', channelId, isFav),
  recordPlayback: (channelId, positionSec) => ipcRenderer.invoke('record-playback', channelId, positionSec),
  savePlaybackPosition: (channelId, positionSec) => ipcRenderer.invoke('save-position', channelId, positionSec),
  clearHistory: () => ipcRenderer.invoke('clear-history'),

  // Safe External Links (ARN Technology Standards)
  openSocialLink: (url) => ipcRenderer.send('open-external-url', url),

  // Desktop Window Controls
  windowControl: (action) => ipcRenderer.invoke('window-control', action),

  // Progress Listener
  onProgress: (callback) => {
    const handler = (_event, val) => callback(val);
    ipcRenderer.on('import-progress', handler);
    return () => ipcRenderer.removeListener('import-progress', handler);
  }
});
