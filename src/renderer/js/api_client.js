'use strict';

/**
 * ARN IPTV Pro — Unified Renderer API Client
 * Copyright © 2026 عبده رجب نصار — شركة ARN Technology
 *
 * Uses `window.api` exposed by Electron `preload.js` (`contextBridge`) when running
 * inside Electron Desktop, and transparently falls back to relative `/api/*` HTTP
 * endpoints when accessed via the Web Preview / LAN server.
 */

(function initApiClient() {
  if (window.api && window.api.isElectron) {
    return;
  }

  async function reqJson(url, method = 'GET', bodyObj = null) {
    const opts = {
      method,
      headers: { Accept: 'application/json' }
    };
    if (bodyObj !== null) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(bodyObj);
    }
    const resp = await fetch(url, opts);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.error || `خطأ في الخادم (${resp.status})`);
    }
    return data;
  }

  const progressListeners = new Set();
  let sse = null;

  function ensureProgressStream() {
    if (sse || typeof EventSource === 'undefined') return;
    try {
      sse = new EventSource('/api/progress');
      sse.onmessage = (evt) => {
        if (!evt.data) return;
        try {
          const parsed = JSON.parse(evt.data);
          progressListeners.forEach((cb) => cb(parsed));
        } catch (_e) {}
      };
    } catch (_e) {}
  }

  window.api = {
    isElectron: false,

    getAppStatus: () => reqJson('/api/status', 'GET'),
    getSettings: () => reqJson('/api/settings', 'GET'),
    setSetting: (key, value) => reqJson('/api/settings', 'POST', { key, value }),

    loadPlaylists: () => reqJson('/api/playlists', 'GET'),
    setActivePlaylist: (playlistId) => reqJson('/api/playlists/active', 'POST', { playlistId }),
    deletePlaylist: (playlistId) => reqJson('/api/playlists/delete', 'POST', { playlistId }),

    importFgCode: (code) => reqJson('/api/import/fg', 'POST', { code }),
    importM3uUrl: (payload) => reqJson('/api/import/m3u-url', 'POST', payload),
    importM3uText: (payload) => reqJson('/api/import/m3u-text', 'POST', payload),
    pickAndImportM3uFile: () =>
      new Promise((resolve, reject) => {
        const fileInput = document.getElementById('webFileInput');
        if (!fileInput) return resolve({ canceled: true });
        fileInput.value = '';
        fileInput.onchange = async () => {
          const file = fileInput.files && fileInput.files[0];
          if (!file) return resolve({ canceled: true });
          try {
            const content = await file.text();
            const baseName = file.name.replace(/\.[^.]+$/, '');
            const res = await reqJson('/api/import/m3u-text', 'POST', {
              name: `ملف محلي (${baseName})`,
              content
            });
            resolve(res);
          } catch (err) {
            reject(err);
          }
        };
        fileInput.click();
      }),
    importXtream: (payload) => reqJson('/api/import/xtream', 'POST', payload),
    seedDemoBouquet: () => reqJson('/api/import/demo', 'POST', {}),
    run50kBenchmark: (count = 50000) => reqJson('/api/import/benchmark', 'POST', { count }),

    getCategories: (params) =>
      reqJson(
        '/api/categories',
        'POST',
        typeof params === 'object' ? params : { playlistId: params }
      ),
    getChannels: (filter) => reqJson('/api/channels', 'POST', filter || {}),
    toggleFavorite: (channelId, isFav) =>
      reqJson('/api/channels/fav', 'POST', { channelId, isFav }),
    recordPlayback: (channelId, positionSec) =>
      reqJson('/api/channels/playback', 'POST', { channelId, positionSec }),
    savePlaybackPosition: (channelId, positionSec) =>
      reqJson('/api/channels/position', 'POST', { channelId, positionSec }),
    clearHistory: () => reqJson('/api/history/clear', 'POST', {}),

    openSocialLink: (url) => {
      if (url && /^https?:\/\//i.test(url)) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },

    windowControl: async () => ({ ok: false }),

    onProgress: (callback) => {
      ensureProgressStream();
      progressListeners.add(callback);
      return () => progressListeners.delete(callback);
    }
  };
})();
