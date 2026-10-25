import { ElectronExportFile } from '../types/iptv.js';

export const ELECTRON_EXPORT_FILES: ElectronExportFile[] = [
  {
    path: 'package.json',
    title: 'package.json — توصيف مشروع Electron وحزم البناء',
    category: 'main',
    language: 'json',
    description: 'ملف الإعداد الرئيسي لمشروع ARN IPTV Desktop شاملاً electron و better-sqlite3 و hls.js وإعدادات electron-builder لنظام ويندوز.',
    content: `{
  "name": "arn-iptv-desktop",
  "productName": "ARN IPTV Pro",
  "version": "2.6.0",
  "description": "ARN IPTV Desktop (Electron Edition) — Developed by Abdo Ragab Nassar (ARN Technology © 2026)",
  "main": "src/main/main.js",
  "author": "عبده رجب نصار — شركة ARN Technology",
  "license": "Proprietary",
  "scripts": {
    "start": "electron .",
    "rebuild": "electron-rebuild -f -w better-sqlite3",
    "pack": "electron-builder --dir",
    "dist": "electron-builder --win --x64"
  },
  "dependencies": {
    "axios": "^1.7.7",
    "better-sqlite3": "^11.5.0",
    "hls.js": "^1.5.17"
  },
  "devDependencies": {
    "@electron/rebuild": "^3.7.1",
    "electron": "^33.2.0",
    "electron-builder": "^25.1.8"
  },
  "build": {
    "appId": "com.arntechnology.iptvpro",
    "productName": "ARN IPTV Pro",
    "copyright": "Copyright © 2026 ARN Technology — Abdo Ragab Nassar",
    "win": {
      "target": ["nsis", "dir"],
      "icon": "src/renderer/assets/icons/app_icon.ico"
    }
  }
}`,
  },
  {
    path: 'src/main/main.js',
    title: 'src/main/main.js — المعالج الرئيسي ودورة حياة التطبيق',
    category: 'main',
    language: 'javascript',
    description: 'يدير نافذة سطح المكتب، يشغّل بروكسي البث المحلي على المنفذ 39871، ويربط قنوات IPC بقاعدة بيانات SQLite ومحرك دراما لايف.',
    content: `const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { startStreamProxy } = require('./stream_proxy');
const { initDatabase, getCategories, getChannels, toggleFavorite, saveImportedChannels } = require('./database');
const { fetchDramaLiveCatalog } = require('./fg_engine');

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 880,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#070b14',
    title: 'ARN IPTV Pro — ARN Technology',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  initDatabase();
  startStreamProxy();
  createMainWindow();

  // IPC Handlers
  ipcMain.handle('get-categories', (_event, playlistId) => getCategories(playlistId));
  ipcMain.handle('get-channels', (_event, filter) => getChannels(filter));
  ipcMain.handle('toggle-fav', (_event, channelId, isFav) => toggleFavorite(channelId, isFav));

  ipcMain.handle('resolve-fg-code', async (event, code) => {
    const items = await fetchDramaLiveCatalog(code, (progress) => {
      event.sender.send('import-progress', progress);
    });
    saveImportedChannels(code, items);
    return { success: true, count: items.length };
  });

  ipcMain.on('open-external-url', (_event, targetUrl) => {
    if (typeof targetUrl === 'string' && /^https?:\\/\\//i.test(targetUrl)) {
      shell.openExternal(targetUrl);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});`,
  },
  {
    path: 'src/main/fg_engine.js',
    title: 'src/main/fg_engine.js — محرك فك تشفير دراما لايف AES-128-CBC',
    category: 'main',
    language: 'javascript',
    description: 'المحرك النقي بلغة Node.js لتشفير وفك تشفير حزم دراما لايف v187 بدون الحاجة إلى بايثون.',
    content: `const crypto = require('crypto');
const axios = require('axios');

const DRAMA_KEY = Buffer.from('0123456789abcdef', 'utf8');
const DRAMA_IV  = Buffer.from('fedcba9876543210', 'utf8');

function encryptPayload(dataObj) {
  const plain = JSON.stringify(dataObj);
  const cipher = crypto.createCipheriv('aes-128-cbc', DRAMA_KEY, DRAMA_IV);
  let encrypted = cipher.update(plain, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const ivB64 = DRAMA_IV.toString('base64');
  return \`\${encrypted}:\${ivB64}\`;
}

function decryptPayload(encStr) {
  const parts = String(encStr).trim().replace(/"/g, '').split(':');
  if (parts.length !== 2) return encStr;
  const ct = Buffer.from(parts[0], 'base64');
  const iv = Buffer.from(parts[1], 'base64');

  const decipher = crypto.createDecipheriv('aes-128-cbc', DRAMA_KEY, iv);
  let decrypted = decipher.update(ct, null, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function buildDramaPayload(code, topicId = null) {
  const normalizedCode = String(code).trim() === '202122' ? '232425' : String(code).trim();
  const p = {
    user_id: "_23351_1713304405644_notloggedin.com_dramalive3",
    device_id: "arn_iptv_dev_9921",
    device_api: "34",
    version_name: "187",
    language: "ar",
    timezone: "Africa/Cairo",
    device_type: "phone",
    KEY_ACTIVATED_TYPE: normalizedCode,
    store: "playStore",
    type: "tv",
    isStoreVersion: true,
    isPremium: false,
    isCoupon_active: false,
    hideAds: false,
    appCount: "1",
    mainServer: "http://main.eastgoessouth.online/api/live/livedrama/v13.0.0/"
  };
  if (topicId) p.topic = String(topicId);
  return p;
}

const DRAMA_TOPICS = [
  { key: 'bein_sport', name: 'باقة بي إن سبورت — beIN Sports' },
  { key: 'mbc', name: 'باقة إم بي سي — MBC Group' },
  { key: 'shahid', name: 'باقة شاهد — Shahid VIP' },
  { key: 'rotana', name: 'باقة روتانا — Rotana Channels' },
  { key: 'osn', name: 'باقة أو إس إن — OSN Network' },
  { key: 'roya', name: 'باقة رؤيا — Roya TV' },
  { key: 'art', name: 'باقة إيه آر تي — ART Channels' },
  { key: 'netflix', name: 'باقة نتفليكس — Netflix Live' },
  { key: 'kurdistan', name: 'إقليم كردستان — Kurdistan TV' },
  { key: 'mr', name: 'موريتانيا — Mauritania TV' },
  { key: 'dj', name: 'جيبوتي — Djibouti TV' },
  { key: 'km', name: 'جزر القمر — Comoros TV' },
  { key: 'tr', name: 'تركيا — Turkey TV' },
  { key: 'fr', name: 'فرنسا — France TV' },
  { key: 'gb', name: 'بريطانيا — United Kingdom TV' },
  { key: 'de', name: 'ألمانيا — Germany TV' },
  { key: 'it', name: 'إيطاليا — Italy TV' },
  { key: 'us', name: 'الولايات المتحدة — USA TV' }
];

module.exports = { encryptPayload, decryptPayload, buildDramaPayload, DRAMA_TOPICS };`,
  },
  {
    path: 'src/main/stream_proxy.js',
    title: 'src/main/stream_proxy.js — خادم البروكسي المحلي ومزيل تشويش k9x_',
    category: 'main',
    language: 'javascript',
    description: 'يعمل على المنفذ المحلي 127.0.0.1:39871 لحل الروابط المحمية وإزالة بادئات التشويش k9x_ من ملفات M3U8 وتمرير مقاطع TS.',
    content: `const http = require('http');
const url = require('url');
const axios = require('axios');
const { encryptPayload, decryptPayload, buildDramaPayload } = require('./fg_engine');

const PROXY_PORT = 39871;
const streamCache = new Map();

async function resolveFgStream(code, idLive) {
  const headers = {
    'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 14; Build/UP1A.231005.007)',
    'Content-Type': 'text/plain; charset=utf-8'
  };
  const payload = buildDramaPayload(code);

  const pId = { ...payload, id: [idLive] };
  const rId = await axios.post(
    'http://live.eastgoessouth.online/api/live/livedrama/v13.0.0/getLiveById',
    encryptPayload(pId),
    { headers, timeout: 8000 }
  );
  const decId = JSON.parse(decryptPayload(rId.data));
  const liveInfo = decId.live?.[0] || {};

  if (liveInfo.url && String(liveInfo.url).startsWith('http') && liveInfo.agent !== 'redirect' && liveInfo.agent !== 'all_streams_redirect') {
    return { streamUrl: liveInfo.url, headers: {}, agent: liveInfo.agent || "", swap: {} };
  }

  const pRed = { ...payload, id: idLive, url: liveInfo.url, agent: liveInfo.agent };
  const rRed = await axios.post(
    'http://redirect.eastgoessouth.online/redirect/getLiveByRedirect',
    encryptPayload(pRed),
    { headers, timeout: 8000 }
  );
  const decRed = JSON.parse(decryptPayload(rRed.data));
  const rawUrl = decRed.data?.url || "";

  if (rawUrl.startsWith('{')) {
    try {
      const adv = JSON.parse(rawUrl);
      return {
        streamUrl: adv.url,
        headers: adv.headers || {},
        agent: adv.agent || "",
        swap: adv.swap || {}
      };
    } catch (e) {}
  }
  return { streamUrl: rawUrl, headers: {}, agent: liveInfo.agent || "", swap: {} };
}

function startStreamProxy() {
  const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname || '';

    if (pathname === '/ping') {
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
      return res.end('pong');
    }

    if (pathname.startsWith('/live/')) {
      const idLive = pathname.replace('/live/', '').replace('.m3u8', '');
      const code = parsed.query.code || "202122";

      let info = streamCache.get(idLive);
      if (!info) {
        info = await resolveFgStream(code, idLive);
        if (info?.streamUrl) streamCache.set(idLive, info);
      }

      if (!info?.streamUrl) {
        res.writeHead(404);
        return res.end('Channel stream not found');
      }

      try {
        const reqHeaders = { ...info.headers };
        if (info.agent) reqHeaders['User-Agent'] = info.agent;

        const response = await axios.get(info.streamUrl, { headers: reqHeaders, timeout: 10000 });
        const baseUrl = info.streamUrl.substring(0, info.streamUrl.lastIndexOf('/') + 1);
        const swap = info.swap || {};

        const lines = response.data.split('\\n');
        const newLines = lines.map(line => {
          const l = line.trim();
          if (!l || l.startsWith('#')) return l;
          if (l.includes('.m3u8')) {
            const fullSub = new URL(l, baseUrl).href;
            return \`http://127.0.0.1:\${PROXY_PORT}/subplaylist?id=\${idLive}&u=\${encodeURIComponent(fullSub)}\`;
          }
          let segName = l;
          for (const [k, v] of Object.entries(swap)) {
            segName = segName.split(k).join(v);
          }
          const fullSeg = new URL(segName, baseUrl).href;
          return \`http://127.0.0.1:\${PROXY_PORT}/ts?id=\${idLive}&u=\${encodeURIComponent(fullSeg)}\`;
        });

        const body = Buffer.from(newLines.join('\\n'), 'utf8');
        res.writeHead(200, {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Content-Length': body.length,
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(body);
      } catch (err) {
        streamCache.delete(idLive);
        res.writeHead(500);
        return res.end(err.message);
      }
    }

    if (pathname.startsWith('/ts')) {
      const targetUrl = parsed.query.u;
      const idLive = parsed.query.id;
      const info = streamCache.get(idLive) || {};
      const reqHeaders = { ...info.headers };
      if (info.agent) reqHeaders['User-Agent'] = info.agent;

      try {
        const streamResp = await axios.get(targetUrl, {
          headers: reqHeaders,
          responseType: 'stream',
          timeout: 15000
        });
        res.writeHead(streamResp.status, {
          'Content-Type': streamResp.headers['content-type'] || 'video/mp2t',
          'Access-Control-Allow-Origin': '*'
        });
        streamResp.data.pipe(res);
      } catch (e) {
        res.writeHead(502);
        res.end();
      }
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(PROXY_PORT, '127.0.0.1', () => {
    console.log(\`[ARN Proxy] Running on http://127.0.0.1:\${PROXY_PORT}\`);
  });
}

module.exports = { startStreamProxy };`,
  },
  {
    path: 'src/main/database.js',
    title: 'src/main/database.js — محرك قاعدة البيانات السريع better-sqlite3',
    category: 'main',
    language: 'javascript',
    description: 'يدير تخزين واستعلام أكثر من 50,000 قناة لحظياً باستخدام SQLite بنمط WAL المتزامن مع فهارس بحث سريعة.',
    content: `const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db = null;

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'arn_iptv_pro.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(\`
    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      code_or_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      playlist_id TEXT NOT NULL,
      category_name TEXT NOT NULL,
      name TEXT NOT NULL,
      logo TEXT,
      stream_url TEXT NOT NULL,
      fg_live_id TEXT,
      is_favorite INTEGER DEFAULT 0,
      last_watched DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_channels_cat ON channels(category_name);
    CREATE INDEX IF NOT EXISTS idx_channels_name ON channels(name);
    CREATE INDEX IF NOT EXISTS idx_channels_fav ON channels(is_favorite);
  \`);
}

function getCategories(playlistId) {
  const stmt = db.prepare(\`
    SELECT category_name AS name, COUNT(*) AS count
    FROM channels
    WHERE (? IS NULL OR playlist_id = ?)
    GROUP BY category_name
    ORDER BY count DESC
  \`);
  return stmt.all(playlistId, playlistId);
}

function getChannels({ category, search, onlyFav, limit = 500 }) {
  let sql = 'SELECT * FROM channels WHERE 1=1';
  const params = [];

  if (category && category !== 'ALL') {
    sql += ' AND category_name = ?';
    params.push(category);
  }
  if (onlyFav) {
    sql += ' AND is_favorite = 1';
  }
  if (search) {
    sql += ' AND name LIKE ?';
    params.push(\`%\${search}%\`);
  }
  sql += ' LIMIT ?';
  params.push(limit);

  return db.prepare(sql).all(...params);
}

function toggleFavorite(channelId, isFav) {
  return db.prepare('UPDATE channels SET is_favorite = ? WHERE id = ?').run(isFav ? 1 : 0, channelId);
}

function saveImportedChannels(playlistId, items) {
  const insert = db.prepare(\`
    INSERT OR REPLACE INTO channels (id, playlist_id, category_name, name, logo, stream_url, fg_live_id)
    VALUES (@id, @playlistId, @category, @name, @logo, @url, @fgLiveId)
  \`);
  const tx = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  tx(items);
}

module.exports = { initDatabase, getCategories, getChannels, toggleFavorite, saveImportedChannels };`,
  },
  {
    path: 'src/preload/preload.js',
    title: 'src/preload/preload.js — جسر الحماية وعزل السياق (contextBridge)',
    category: 'preload',
    language: 'javascript',
    description: 'يوفر واجهة برمجية آمنة window.api لواجهة العرض مع تفعيل contextIsolation: true ومنع الوصول المباشر لـ Node.js.',
    content: `const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadPlaylists: () => ipcRenderer.invoke('get-playlists'),
  importFgCode: (code) => ipcRenderer.invoke('resolve-fg-code', code),
  getCategories: (playlistId) => ipcRenderer.invoke('get-categories', playlistId),
  getChannels: (filter) => ipcRenderer.invoke('get-channels', filter),
  toggleFavorite: (channelId, isFav) => ipcRenderer.invoke('toggle-fav', channelId, isFav),
  openSocialLink: (url) => ipcRenderer.send('open-external-url', url),
  onProgress: (callback) => ipcRenderer.on('import-progress', (_e, val) => callback(val))
});`,
  },
  {
    path: 'Run-DesktopApp.bat',
    title: 'Run-DesktopApp.bat — مشغل ويندوز النظيف بترميز UTF-8 (chcp 65001)',
    category: 'launcher',
    language: 'batch',
    description: 'مشغل رسمي يضبط صفحة الترميز 65001 لمنع أخطاء الحروف العربية في المسارات ويقلع التطبيق عبر PowerShell.',
    content: `@echo off
chcp 65001 >nul
title ARN IPTV Pro Launcher — ARN Technology
cd /d "%~dp0"
echo [ARN Technology] Starting ARN IPTV Desktop (Electron Edition)...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Run-DesktopApp.ps1"
exit /b 0`,
  },
  {
    path: 'Run-DesktopApp.ps1',
    title: 'Run-DesktopApp.ps1 — سكريبت الإقلاع والتحقق من البيئة',
    category: 'launcher',
    language: 'powershell',
    description: 'يتحقق من الحزم المثبتة ويقوم بتشغيل تطبيق Electron بسلاسة مع دعم مسارات UTF-8.',
    content: `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "   ARN IPTV Desktop (Electron Edition) — © 2026      " -ForegroundColor Emerald
Write-Host "   Developer: Abdo Ragab Nassar — ARN Technology     " -ForegroundColor Gray
Write-Host "=====================================================" -ForegroundColor Cyan

if (-not (Test-Path "node_modules")) {
    Write-Host "[!] Installing dependencies..." -ForegroundColor Yellow
    npm install
}

npm start`,
  },
  {
    path: 'build/ARN-IPTV-Setup.iss',
    title: 'build/ARN-IPTV-Setup.iss — سكريبت المثبت الرسمي والتوقيع الرقمي Inno Setup',
    category: 'installer',
    language: 'ini',
    description: 'يثبت شهادة ARN Technology تلقائياً في مخزن Root و TrustedPublisher مع ختم الوقت RFC-3161 DigiCert SHA256.',
    content: `#define MyAppName "ARN IPTV Pro"
#define MyAppVersion "2.6.0"
#define MyAppPublisher "ARN Technology — Abdo Ragab Nassar"
#define MyAppExeName "ARN IPTV Pro.exe"

[Setup]
AppId={{8F9A2D41-7C11-4E53-9B2A-ARN2026IPTV01}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\\ARN Technology\\{#MyAppName}
DefaultGroupName={#MyAppName}
OutputBaseFilename=ARN-IPTV-Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
SignTool=signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /n "ARN Technology" $f

[Files]
Source: "..\\dist\\win-unpacked\\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\\cert\\ARN_Technology_Root.cer"; DestDir: "{app}\\cert"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\\{#MyAppName}"; Filename: "{app}\\{#MyAppExeName}"
Name: "{autodesktop}\\{#MyAppName}"; Filename: "{app}\\{#MyAppExeName}"

[Run]
Filename: "certutil.exe"; Parameters: "-addstore -f ""Root"" ""{app}\\cert\\ARN_Technology_Root.cer"""; Flags: runhidden waituntilterminated
Filename: "certutil.exe"; Parameters: "-addstore -f ""TrustedPublisher"" ""{app}\\cert\\ARN_Technology_Root.cer"""; Flags: runhidden waituntilterminated
Filename: "{app}\\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent`,
  },
];
