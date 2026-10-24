'use strict';

/**
 * ARN IPTV Pro — Live Web Preview & LAN Bridge Server
 * Copyright © 2026 عبده رجب نصار — شركة ARN Technology
 *
 * Exposes the exact Electron Main Process engines (`ArnAppService`, `fg_engine`,
 * `stream_proxy`, `database`, `playlist_parser`) and serves `src/renderer/`
 * using relative `/api/*` and `/proxy/*` routes bound to `0.0.0.0`.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { startStreamProxy, handleProxyRequest, DEFAULT_PROXY_PORT } = require('../main/stream_proxy');
const { ArnAppService } = require('../main/app_service');

const PORT = Number(process.env.PORT || 3000);
const RENDERER_DIR = path.resolve(__dirname, '..', 'renderer');
const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t'
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 25 * 1024 * 1024) {
        reject(new Error('حجم الملف يتجاوز الحد المسموح (25MB)'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(new Error('تنسيق JSON غير صالح'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

async function startWebPreview() {
  const proxyInfo = await startStreamProxy(DEFAULT_PROXY_PORT);
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const appService = new ArnAppService({
    dbPath: path.join(DATA_DIR, 'arn_iptv_preview.db'),
    // Relative `/proxy` ensures browser clients never contact 127.0.0.1 directly
    getProxyBase: () => '/proxy'
  });

  const sseClients = new Set();
  const broadcastProgress = (payload) => {
    const msg = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(msg);
      } catch (_e) {
        sseClients.delete(client);
      }
    }
  };

  const server = http.createServer(async (req, res) => {
    // CORS Preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Range'
      });
      return res.end();
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch (_e) {
      return sendJson(res, 400, { error: 'Invalid URL' });
    }

    const pathname = parsedUrl.pathname;

    // 1. Stream Proxy Mount (`/proxy/*`)
    if (pathname === '/proxy' || pathname.startsWith('/proxy/')) {
      return handleProxyRequest(req, res, {
        proxyPort: proxyInfo.port,
        mountPrefix: '/proxy'
      });
    }

    // 2. SSE Import Progress Stream (`/api/progress`)
    if (pathname === '/api/progress' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write(':\n\n');
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    // 3. Unified JSON API mirroring Preload IPC (`window.api`)
    if (pathname.startsWith('/api/')) {
      try {
        if (pathname === '/api/status' && req.method === 'GET') {
          return sendJson(res, 200, {
            ...appService.getAppStatus(),
            runtime: 'web-preview',
            proxyPort: proxyInfo.port
          });
        }

        if (pathname === '/api/settings' && req.method === 'GET') {
          return sendJson(res, 200, appService.getSettings());
        }

        if (pathname === '/api/settings' && req.method === 'POST') {
          const body = await readJsonBody(req);
          return sendJson(res, 200, appService.setSetting(body.key, body.value));
        }

        if (pathname === '/api/playlists' && req.method === 'GET') {
          return sendJson(res, 200, appService.getPlaylists());
        }

        if (pathname === '/api/playlists/active' && req.method === 'POST') {
          const body = await readJsonBody(req);
          return sendJson(res, 200, appService.setActivePlaylist(body.playlistId));
        }

        if (pathname === '/api/playlists/delete' && req.method === 'POST') {
          const body = await readJsonBody(req);
          return sendJson(res, 200, appService.deletePlaylist(body.playlistId));
        }

        if (pathname === '/api/import/fg' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const out = await appService.importFgCode(body.code, broadcastProgress);
          return sendJson(res, 200, out);
        }

        if (pathname === '/api/import/m3u-url' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const out = await appService.importM3uFromUrl(body, broadcastProgress);
          return sendJson(res, 200, out);
        }

        if (pathname === '/api/import/m3u-text' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const out = appService.importM3uFromText(body, broadcastProgress);
          return sendJson(res, 200, out);
        }

        if (pathname === '/api/import/xtream' && req.method === 'POST') {
          const body = await readJsonBody(req);
          const out = await appService.importXtream(body, broadcastProgress);
          return sendJson(res, 200, out);
        }

        if (pathname === '/api/import/demo' && req.method === 'POST') {
          return sendJson(res, 200, appService.seedDemoBouquet());
        }

        if (pathname === '/api/import/benchmark' && req.method === 'POST') {
          const body = await readJsonBody(req);
          return sendJson(res, 200, appService.run50kBenchmark(body.count || 50000, broadcastProgress));
        }

        if (pathname === '/api/categories' && req.method === 'POST') {
          const body = await readJsonBody(req);
          return sendJson(res, 200, appService.getCategories(body));
        }

        if (pathname === '/api/channels' && req.method === 'POST') {
          const body = await readJsonBody(req);
          return sendJson(res, 200, appService.getChannels(body));
        }

        if (pathname === '/api/channels/fav' && req.method === 'POST') {
          const body = await readJsonBody(req);
          return sendJson(res, 200, appService.toggleFavorite(body.channelId, body.isFav));
        }

        if (pathname === '/api/channels/playback' && req.method === 'POST') {
          const body = await readJsonBody(req);
          return sendJson(res, 200, appService.recordPlayback(body.channelId, body.positionSec));
        }

        if (pathname === '/api/channels/position' && req.method === 'POST') {
          const body = await readJsonBody(req);
          return sendJson(res, 200, appService.savePlaybackPosition(body.channelId, body.positionSec));
        }

        if (pathname === '/api/history/clear' && req.method === 'POST') {
          return sendJson(res, 200, appService.clearHistory());
        }

        return sendJson(res, 404, { error: 'Unknown API endpoint' });
      } catch (err) {
        return sendJson(res, 400, { error: err.message || 'حدث خطأ أثناء تنفيذ العملية' });
      }
    }

    // 4. Static Renderer Assets (`src/renderer/*`)
    const relPath = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
    const resolvedFile = path.resolve(RENDERER_DIR, `.${relPath}`);
    if (!resolvedFile.startsWith(RENDERER_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    if (fs.existsSync(resolvedFile) && fs.statSync(resolvedFile).isFile()) {
      const ext = path.extname(resolvedFile).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      const stat = fs.statSync(resolvedFile);
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': stat.size,
        'Cache-Control': ext === '.woff2' ? 'public, max-age=86400' : 'no-cache'
      });
      return fs.createReadStream(resolvedFile).pipe(res);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[ARN Web Preview] Listening on http://0.0.0.0:${PORT}`);
  });
}

if (require.main === module) {
  startWebPreview().catch((err) => {
    console.error('[ARN Web Preview] Fatal startup error:', err);
    process.exit(1);
  });
}

module.exports = { startWebPreview };
