'use strict';

/**
 * ARN IPTV Pro — Electron Main Process
 * Copyright © 2026 عبده رجب نصار — شركة ARN Technology
 *
 * Manages application lifecycle, GPU hardware acceleration, local HLS/FG stream proxy,
 * SQLite database engine, IPC channels, custom frameless window controls, and System Tray.
 */

const path = require('path');
const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  Menu,
  Tray,
  nativeImage
} = require('electron');

const { startStreamProxy, DEFAULT_PROXY_PORT } = require('./stream_proxy');
const { ArnAppService } = require('./app_service');

// Enable GPU Video Decode & Smooth Compositing
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let mainWindow = null;
let tray = null;
let proxyServerInfo = { server: null, port: DEFAULT_PROXY_PORT, baseUrl: `http://127.0.0.1:${DEFAULT_PROXY_PORT}` };
let appService = null;
let isQuitting = false;

// Ensure single desktop instance
const gotSingleLock = app.requestSingleInstanceLock();
if (!gotSingleLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function sendImportProgress(progressPayload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('import-progress', progressPayload);
  }
}

function createMainWindow() {
  const iconPath = path.join(__dirname, '..', 'renderer', 'assets', 'icons', 'app_icon.png');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 880,
    minWidth: 1060,
    minHeight: 660,
    title: 'ARN IPTV Pro — ARN Technology',
    backgroundColor: '#070b14',
    frame: false,
    titleBarStyle: 'hidden',
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      spellcheck: false
    }
  });

  Menu.setApplicationMenu(null);

  const indexPath = path.join(__dirname, '..', 'renderer', 'index.html');
  mainWindow.loadFile(indexPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.argv.includes('--dev')) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // Prevent navigation away from app shell
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createSystemTray() {
  try {
    const iconPath = path.join(__dirname, '..', 'renderer', 'assets', 'icons', 'app_icon.png');
    const img = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
    tray = new Tray(img);
    tray.setToolTip('ARN IPTV Pro — ARN Technology');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'إظهار ARN IPTV Pro',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'إغلاق التطبيق بالكامل',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (_err) {
    // Non-fatal on headless systems without system tray
  }
}

function openExternalSafely(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:') {
      shell.openExternal(parsed.href);
    }
  } catch (_e) {}
}

function registerIpcHandlers() {
  ipcMain.handle('get-app-status', () => ({
    ...appService.getAppStatus(),
    runtime: 'electron',
    proxyPort: proxyServerInfo.port
  }));

  ipcMain.handle('get-settings', () => appService.getSettings());
  ipcMain.handle('set-setting', (_e, key, value) => appService.setSetting(key, value));

  ipcMain.handle('get-playlists', () => appService.getPlaylists());
  ipcMain.handle('set-active-playlist', (_e, playlistId) => appService.setActivePlaylist(playlistId));
  ipcMain.handle('delete-playlist', (_e, playlistId) => appService.deletePlaylist(playlistId));

  ipcMain.handle('resolve-fg-code', async (_e, code) => {
    return appService.importFgCode(code, sendImportProgress);
  });

  ipcMain.handle('import-m3u-url', async (_e, payload) => {
    return appService.importM3uFromUrl(payload || {}, sendImportProgress);
  });

  ipcMain.handle('import-m3u-text', async (_e, payload) => {
    return appService.importM3uFromText(payload || {}, sendImportProgress);
  });

  ipcMain.handle('pick-import-m3u-file', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'اختر ملف قائمة قنوات M3U / M3U8',
      properties: ['openFile'],
      filters: [
        { name: 'قوائم البث (M3U / M3U8)', extensions: ['m3u', 'm3u8', 'txt'] },
        { name: 'جميع الملفات', extensions: ['*'] }
      ]
    });
    if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
      return { canceled: true };
    }
    const chosenFile = res.filePaths[0];
    const baseName = path.basename(chosenFile, path.extname(chosenFile));
    return appService.importM3uFromFile(
      { name: `ملف محلي (${baseName})`, filePath: chosenFile },
      sendImportProgress
    );
  });

  ipcMain.handle('import-xtream', async (_e, payload) => {
    return appService.importXtream(payload || {}, sendImportProgress);
  });

  ipcMain.handle('seed-demo-bouquet', () => appService.seedDemoBouquet());
  ipcMain.handle('run-50k-benchmark', (_e, count) =>
    appService.run50kBenchmark(count, sendImportProgress)
  );

  ipcMain.handle('get-categories', (_e, params) => appService.getCategories(params));
  ipcMain.handle('get-channels', (_e, filter) => appService.getChannels(filter));
  ipcMain.handle('get-channel-by-id', (_e, id) => appService.getChannelById(id));
  ipcMain.handle('toggle-fav', (_e, channelId, isFav) =>
    appService.toggleFavorite(channelId, isFav)
  );
  ipcMain.handle('record-playback', (_e, channelId, posSec) =>
    appService.recordPlayback(channelId, posSec)
  );
  ipcMain.handle('save-position', (_e, channelId, posSec) =>
    appService.savePlaybackPosition(channelId, posSec)
  );
  ipcMain.handle('clear-history', () => appService.clearHistory());

  ipcMain.on('open-external-url', (_e, url) => {
    openExternalSafely(url);
  });

  ipcMain.handle('window-control', (_e, action) => {
    if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };
    switch (action) {
      case 'minimize':
        mainWindow.minimize();
        return { ok: true };
      case 'maximize':
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        return { ok: true, isMaximized: mainWindow.isMaximized() };
      case 'toggle-pin': {
        const nextPin = !mainWindow.isAlwaysOnTop();
        mainWindow.setAlwaysOnTop(nextPin);
        return { ok: true, isAlwaysOnTop: nextPin };
      }
      case 'close':
        isQuitting = true;
        mainWindow.close();
        return { ok: true };
      default:
        return { ok: false };
    }
  });
}

app.whenReady().then(async () => {
  proxyServerInfo = await startStreamProxy(DEFAULT_PROXY_PORT);

  const dbPath = path.join(app.getPath('userData'), 'arn_iptv_pro.db');
  appService = new ArnAppService({
    dbPath,
    getProxyBase: () => proxyServerInfo.baseUrl
  });

  registerIpcHandlers();
  createMainWindow();
  createSystemTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  if (proxyServerInfo.server) {
    try {
      proxyServerInfo.server.close();
    } catch (_e) {}
  }
  if (appService) {
    try {
      appService.close();
    } catch (_e) {}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || isQuitting) {
    app.quit();
  }
});
