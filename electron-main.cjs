const { app, BrowserWindow, ipcMain, shell, Tray, Menu } = require('electron');
const path = require('path');
const { startServer } = require('./dist-server/server.cjs');

let mainWindow = null;
let runningServer = null;
let activePort = 3000;

// Ensure single instance application lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
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

/**
 * Creates the primary application window with Dark Glassmorphism aesthetics
 */
function createMainWindow(port) {
  const iconPath = path.join(__dirname, 'public/assets/icons/app_icon.ico');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 880,
    minWidth: 1024,
    minHeight: 650,
    backgroundColor: '#070b14',
    title: 'ARN IPTV Pro — منصة البث الفضائي العربي الحي (ARN Technology)',
    icon: iconPath,
    autoHideMenuBar: true,
    frame: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  const appUrl = `http://127.0.0.1:${port}`;
  console.log(`[ARN IPTV Pro Electron] Loading UI from: ${appUrl}`);

  mainWindow.loadURL(appUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle load failure gracefully
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron] Failed to load URL ${validatedURL}: ${errorDescription} (${errorCode})`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(appUrl);
      }
    }, 1500);
  });

  // Handle external link clicks safely in system default browser with scheme and domain allowlist
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        const allowedDomains = [
          'wa.me',
          'whatsapp.com',
          't.me',
          'telegram.me',
          'telegram.org',
          'facebook.com',
          'fb.com',
          'm.me',
          'github.com',
          'youtube.com',
          'youtu.be',
          'twitter.com',
          'x.com',
          'google.com',
          'wikipedia.org',
        ];
        const isAllowed = allowedDomains.some((d) => parsed.hostname.toLowerCase().endsWith(d));
        if (isAllowed) {
          shell.openExternal(url);
        }
      }
    } catch {}
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Start the pure Node.js embedded server (zero external dependency, no npx, no tsx)
  try {
    const distDir = path.join(__dirname, 'dist');
    runningServer = await startServer(3000, distDir);
    activePort = runningServer.port;
    console.log(`[ARN IPTV Pro Electron] Embedded server started on port ${activePort}`);
  } catch (err) {
    console.error('[ARN IPTV Pro Electron] Failed to start embedded server:', err);
    activePort = 3000;
  }

  createMainWindow(activePort);

  // IPC Handlers
  ipcMain.handle('app-version', () => app.getVersion());
  ipcMain.handle('is-fullscreen', () => (mainWindow ? mainWindow.isFullScreen() : false));
  ipcMain.on('toggle-fullscreen', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(activePort);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (runningServer && typeof runningServer.close === 'function') {
      try {
        runningServer.close();
      } catch {}
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  if (runningServer && typeof runningServer.close === 'function') {
    try {
      runningServer.close();
    } catch {}
  }
});
