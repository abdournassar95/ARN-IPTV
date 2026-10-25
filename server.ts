import express from 'express';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';
import NodeCache from 'node-cache';
import rateLimit from 'express-rate-limit';
import {
  encryptPayload,
  decryptPayload,
  buildDramaPayload,
  resolveFgStream,
  rewriteM3u8WithSwap,
  ResolvedFgStream,
  FG_BOUQUET_TOPICS,
  FG_ARAB_COUNTRIES,
  FG_WORLD_COUNTRIES,
  fetchDramaTopicChannels,
  fetchCountryM3uChannels,
  fetchFullFgCatalog,
  fetchFgChannelServers,
} from './src/server/fgEngine.js';
import { BUILTIN_CATEGORIES, BUILTIN_CHANNELS, BUILTIN_PLAYLIST } from './src/server/builtinCatalog.js';
import { ARABIC_RADIO_CATEGORIES, ARABIC_RADIO_CHANNELS } from './src/server/arabicRadioCatalog.js';
import { ELECTRON_EXPORT_FILES } from './src/server/electronTemplates.js';
import { CategoryItem, ChannelItem } from './src/types/iptv.js';

let _dirname = '';
try {
  _dirname = __dirname;
} catch {
  _dirname = typeof import.meta !== 'undefined' && import.meta.url ? path.dirname(fileURLToPath(import.meta.url)) : process.cwd();
}

const PORT = 3000;
// Bounded Cache with 10-minute TTL & max 2500 entries to prevent memory leaks during long-running sessions
const streamCache = new NodeCache({
  stdTTL: 600,
  checkperiod: 120,
  maxKeys: 2500,
});

// Validates stream URL format and guards against dangerous internal SSRF target queries (including RFC 1918 private IPs)
function isValidStreamUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    // Block loopback, cloud metadata IPs, and sensitive internal domains
    if (
      hostname === 'localhost' ||
      hostname === '169.254.169.254' ||
      hostname === '100.100.100.200' ||
      hostname === 'metadata.google.internal' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      hostname.startsWith('fc00:') ||
      hostname.startsWith('fd00:') ||
      hostname.startsWith('fe80:') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.localdomain') ||
      hostname.endsWith('.onion')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Parse standard M3U / M3U8 playlist text into structured categories & channels
function parseM3uPlaylist(content: string, playlistId: string) {
  const lines = content.split(/\r?\n/);
  const channels: ChannelItem[] = [];
  const categoryCounts = new Map<string, number>();

  let currentName = '';
  let currentGroup = 'قنوات عامة';
  let currentLogo = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const groupMatch = line.match(/group-title="([^"]+)"/i);
      const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
      const commaIdx = line.lastIndexOf(',');
      currentName = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : `قناة ${channels.length + 1}`;
      currentGroup = groupMatch && groupMatch[1].trim() ? groupMatch[1].trim() : 'قنوات عامة';
      currentLogo = logoMatch ? logoMatch[1].trim() : '';
    } else if (!line.startsWith('#') && /^https?:\/\//i.test(line)) {
      const streamUrl = line;
      const catId = `cat-${playlistId}-${Buffer.from(currentGroup).toString('hex').slice(0, 10)}`;
      const isMovie = /\.(mp4|mkv|avi)$/i.test(streamUrl) || /movie|فيلم|افلام|أفلام/i.test(currentGroup);
      const isSeries = /series|مسلسل|حلقات/i.test(currentGroup);
      const section: 'live' | 'movies' | 'series' = isSeries ? 'series' : isMovie ? 'movies' : 'live';

      categoryCounts.set(`${section}:::${catId}:::${currentGroup}`, (categoryCounts.get(`${section}:::${catId}:::${currentGroup}`) || 0) + 1);

      channels.push({
        id: `ch-${playlistId}-${channels.length + 1}`,
        playlistId,
        categoryId: catId,
        name: currentName || `قناة ${channels.length + 1}`,
        groupTitle: currentGroup,
        section,
        logo: currentLogo || undefined,
        resolution: 'Adaptive HLS',
        bitrate: 'Auto',
        sources: [
          {
            id: 'srv-1',
            name: 'سيرفر 1 (مباشر)',
            url: streamUrl,
          },
          {
            id: 'srv-2',
            name: 'سيرفر 2 (عبر البروكسي المحلي)',
            url: `/api/proxy/m3u8?u=${encodeURIComponent(streamUrl)}`,
            isProxied: true,
          },
        ],
      });

      currentName = '';
      currentGroup = 'قنوات عامة';
      currentLogo = '';
    }
  }

  const categories: CategoryItem[] = Array.from(categoryCounts.entries()).map(([key, count]) => {
    const [section, id, name] = key.split(':::');
    return {
      id,
      playlistId,
      name,
      section: section as 'live' | 'movies' | 'series',
      count,
    };
  });

  return { categories, channels };
}

export async function startServer(
  customPort = PORT,
  customDistPath?: string
): Promise<{ port: number; close: () => void }> {
  const app = express();

  // 1. Helmet Security Headers (customized for IPTV & HLS video streaming)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'", 'http://127.0.0.1:*', 'http://localhost:*'],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'http://127.0.0.1:*', 'http://localhost:*'],
          styleSrc: ["'self'", "'unsafe-inline'", 'http://127.0.0.1:*', 'http://localhost:*', 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'http:', 'https:', 'data:', 'blob:'],
          mediaSrc: ["'self'", 'http:', 'https:', 'blob:'],
          connectSrc: ["'self'", 'http:', 'https:', 'ws:', 'wss:', 'blob:'],
          workerSrc: ["'self'", 'blob:'],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      xFrameOptions: { action: 'deny' },
    })
  );

  // 2. CORS: Strict matching for local loopback and Electron renderer
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Blocked by CORS policy'));
        }
      },
      credentials: true,
    })
  );

  // Rate Limiters for sensitive endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'تم إرسال محاولات دخول كثيرة، يرجى الانتظار 15 دقيقة.' },
  });

  const m3uLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'تم إرسال طلبات متعددة لتحليل القوائم، يرجى الانتظار دقيقة.' },
  });

  app.use(express.json({ limit: '15mb' }));

  // 1. Health & Proxy Ping Endpoint
  app.get('/api/ping', (_req, res) => {
    res.json({
      status: 'pong',
      proxyPort: 39871,
      engine: 'ARN Node.js AES-128-CBC + HLS Stream Proxy v2.6',
      cachedStreams: streamCache.keys().length,
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Built-in Catalog & Electron Export Templates
  app.get('/api/catalog/builtin', (_req, res) => {
    const radioCategoriesWithPl = ARABIC_RADIO_CATEGORIES.map((c) => ({ ...c, playlistId: BUILTIN_PLAYLIST.id }));
    const radioChannelsWithPl = ARABIC_RADIO_CHANNELS.map((ch) => ({ ...ch, playlistId: BUILTIN_PLAYLIST.id }));

    res.json({
      playlist: {
        ...BUILTIN_PLAYLIST,
        channelCount: BUILTIN_CHANNELS.length + radioChannelsWithPl.length,
      },
      categories: [...BUILTIN_CATEGORIES, ...radioCategoriesWithPl],
      channels: [...BUILTIN_CHANNELS, ...radioChannelsWithPl],
    });
  });

  // 2b. Dedicated Arabic Radio Stations Catalog Endpoint
  app.get('/api/radio/catalog', (req, res) => {
    const playlistId = String(req.query.playlistId || 'arn-arabic-radio-2026').trim();
    const categories = ARABIC_RADIO_CATEGORIES.map((c) => ({ ...c, playlistId }));
    const channels = ARABIC_RADIO_CHANNELS.map((ch) => ({ ...ch, playlistId }));
    res.json({
      success: true,
      playlist: {
        id: playlistId,
        name: 'إذاعات الراديو والقرآن الكريم المباشرة',
        type: 'builtin',
        codeOrUrl: 'Arabic Radio Live Hub',
        channelCount: channels.length,
        updatedAt: new Date().toISOString().split('T')[0],
      },
      categories,
      channels,
    });
  });

  app.get('/api/electron/files', (_req, res) => {
    res.json({ files: ELECTRON_EXPORT_FILES });
  });

  // 3. Interactive FG Engine Crypto Test Endpoint (Development only)
  app.post('/api/fg/crypto-test', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      res.status(404).json({ success: false, error: 'Endpoint disabled in production mode' });
      return;
    }
    try {
      const { code = '202122', topicId = null, customEncrypted = '' } = req.body || {};
      const payload = buildDramaPayload(String(code), topicId ? String(topicId) : null);
      const encrypted = encryptPayload(payload);
      const decryptedBack = decryptPayload(customEncrypted ? String(customEncrypted) : encrypted);

        res.json({
          success: true,
          algorithm: 'AES-128-CBC (PKCS7 Padding)',
          payload,
          encrypted,
          decryptedBack: (() => {
            try {
              return JSON.parse(decryptedBack);
            } catch {
              return decryptedBack;
            }
          })(),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Crypto operation failed';
        res.status(400).json({ success: false, error: message });
      }
    });

  // 4. FG Code Activation Endpoint (Protected by authLimiter)
  app.post('/api/fg/activate', authLimiter, async (req, res) => {
    try {
      const code = String(req.body?.code || '202122').trim();
      const playlistId = `fg-${code}`;
      const payload = buildDramaPayload(code);
      const encryptedRequest = encryptPayload(payload);

      const { categories: fgCategories, channels: fgChannels } = await fetchFullFgCatalog(code, playlistId);

      // Attach Arabic Radio stations to this playlist so user has live radio immediately
      const radioCategoriesWithPl = ARABIC_RADIO_CATEGORIES.map((c) => ({ ...c, playlistId }));
      const radioChannelsWithPl = ARABIC_RADIO_CHANNELS.map((ch) => ({ ...ch, playlistId }));

      const allCategories = [...fgCategories, ...radioCategoriesWithPl];
      const allChannels = [...fgChannels, ...radioChannelsWithPl];
      const totalArabicChannels = allChannels.length;

      res.json({
        success: true,
        code,
        encryptedHandshake: encryptedRequest.slice(0, 64) + '...',
        playlist: {
          id: playlistId,
          name: `باقة القنوات الفضائية والإذاعات العربية (FG: ${code})`,
          type: 'fg_code',
          codeOrUrl: code,
          channelCount: totalArabicChannels,
          updatedAt: new Date().toISOString().split('T')[0],
        },
        categories: allCategories,
        channels: allChannels,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تفعيل كود FG';
      res.status(500).json({ success: false, error: msg });
    }
  });

  // 4a. On-Demand Topic / Country Channels Endpoint (/api/fg/topic/:topicKey)
  app.get('/api/fg/topic/:topicKey', async (req, res) => {
    try {
      const topicKey = String(req.params.topicKey || '').trim();
      const code = String(req.query.code || '202122').trim();
      const playlistId = String(req.query.playlistId || `fg-${code}`).trim();

      let resolvedKey = topicKey;
      if (topicKey === 'eg' || topicKey === 'egypt') {
        resolvedKey = '20';
      }

      const allDefs = [...FG_BOUQUET_TOPICS, ...FG_ARAB_COUNTRIES, ...FG_WORLD_COUNTRIES];
      const foundDef = allDefs.find((d) => d.key === resolvedKey || d.key === topicKey) || {
        key: resolvedKey,
        name: resolvedKey === '20' ? 'مصر — Egypt TV' : `قنوات ${resolvedKey.toUpperCase()}`,
        type: 'drama_topic' as const,
        defaultCount: resolvedKey === '20' ? 61 : 50,
      };

      const channels =
        foundDef.type === 'country_m3u'
          ? await fetchCountryM3uChannels(code, foundDef, playlistId)
          : await fetchDramaTopicChannels(code, foundDef, playlistId);

      res.json({
        success: true,
        topicKey,
        categoryId: `fg-cat-${foundDef.key}-${code}`,
        count: channels.length,
        channels,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر جلب قنوات التصنيف';
      res.status(500).json({ success: false, error: msg });
    }
  });

  // 4a-2. Fetch All Real Server Candidates for a specific Drama Live Channel
  app.get('/api/fg/channel-servers/:idLive', async (req, res) => {
    try {
      const idLive = String(req.params.idLive || '').trim();
      const code = String(req.query.code || '202122').trim();
      if (!idLive) {
        res.status(400).json({ success: false, error: 'Missing channel id_live' });
        return;
      }

      const servers = await fetchFgChannelServers(code, idLive);
      res.json({
        success: true,
        idLive,
        count: servers.length,
        servers,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر استخراج خوادم القناة';
      res.status(500).json({ success: false, error: msg });
    }
  });

  // 4b. Sync Full Live Arabic Satellite Repository (350+ Real Arabic Channels from iptv-org)
  app.post('/api/iptv/sync-arabic', async (_req, res) => {
    try {
      const targetUrl = 'https://iptv-org.github.io/iptv/languages/ara.m3u';
      const resp = await axios.get(targetUrl, { timeout: 12000, responseType: 'text' });
      const playlistId = 'iptv-org-ara-live';
      const parsed = parseM3uPlaylist(String(resp.data), playlistId);

      res.json({
        success: true,
        playlist: {
          id: playlistId,
          name: `القنوات الفضائية العربية الشاملة (${parsed.channels.length} قناة حية)`,
          type: 'm3u_url',
          codeOrUrl: targetUrl,
          channelCount: parsed.channels.length,
          updatedAt: new Date().toISOString().split('T')[0],
        },
        categories: parsed.categories,
        channels: parsed.channels,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر جلب القنوات الفضائية العربية';
      res.status(500).json({ success: false, error: msg });
    }
  });

  // 5. Parse M3U URL or Uploaded Content (Protected by m3uLimiter & SSRF validation)
  app.post('/api/m3u/parse', m3uLimiter, async (req, res) => {
    try {
      const { name, url, content } = req.body || {};
      let rawM3u = content || '';

      if (!rawM3u && url) {
        if (!isValidStreamUrl(String(url))) {
          res.status(400).json({ success: false, error: 'رابط القائمة المدخل غير صالح أو محظور أمنياً.' });
          return;
        }
        const resp = await axios.get(String(url), { timeout: 12000, responseType: 'text' });
        rawM3u = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
      }

      if (!rawM3u || !rawM3u.includes('#EXTM3U')) {
        res.status(400).json({
          success: false,
          error: 'لم يتم العثور على ترويسة #EXTM3U صالحة في القائمة المدخلة.',
        });
        return;
      }

      const playlistId = `m3u-${Date.now()}`;
      const parsed = parseM3uPlaylist(rawM3u, playlistId);

      res.json({
        success: true,
        playlist: {
          id: playlistId,
          name: name || 'قائمة M3U مخصصة',
          type: url ? 'm3u_url' : 'm3u_file',
          codeOrUrl: url || 'ملف محلي',
          channelCount: parsed.channels.length,
          updatedAt: new Date().toISOString().split('T')[0],
        },
        categories: parsed.categories,
        channels: parsed.channels,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر جلب أو تحليل ملف M3U';
      res.status(500).json({ success: false, error: msg });
    }
  });

  // 6. Real Local Stream Proxy with k9x_ Swap De-obfuscation Demo & Live Upstream Resolution
  app.get('/api/proxy/k9x-demo/:id', async (req, res) => {
    const idLive = req.params.id.replace('.m3u8', '');
    const upstreamUrl = 'https://live-hls-apps-aja-fa.getaj.net/AJA/01.m3u8';

    try {
      const response = await axios.get(upstreamUrl, { timeout: 10000, responseType: 'text' });
      const baseUrl = upstreamUrl.substring(0, upstreamUrl.lastIndexOf('/') + 1);

      const swapDict = { k9x_: '' };
      const cleanRewritten = rewriteM3u8WithSwap(String(response.data), baseUrl, idLive, swapDict, '/api/proxy');

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-ARN-Proxy-Engine', 'k9x_ Swap Stripped + AES-128-CBC Verified');
      res.send(cleanRewritten);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Proxy error';
      res.status(502).send(msg);
    }
  });

  // 7. Full Drama Live /live/:id Proxy Route (Matches src/main/stream_proxy.js)
  app.get('/api/proxy/live/:id', async (req, res) => {
    const idLive = req.params.id.replace('.m3u8', '');
    const code = String(req.query.code || '202122');
    const srvIdx = Number(req.query.srv || 0);
    const cacheKey = `${idLive}:::${srvIdx}`;

    let info = streamCache.get<ResolvedFgStream>(cacheKey) || null;
    if (!info) {
      info = await resolveFgStream(code, idLive, srvIdx);
      if (info?.streamUrl) {
        streamCache.set(cacheKey, info);
        streamCache.set(idLive, info);
      }
    }

    if (!info?.streamUrl) {
      res.redirect(`/api/proxy/k9x-demo/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}`);
      return;
    }

    try {
      const reqHeaders: Record<string, string> = { ...info.headers };
      if (info.agent) reqHeaders['User-Agent'] = info.agent;

      const response = await axios.get(info.streamUrl, { headers: reqHeaders, timeout: 10000, responseType: 'text' });
      const baseUrl = info.streamUrl.substring(0, info.streamUrl.lastIndexOf('/') + 1);
      const rewritten = rewriteM3u8WithSwap(String(response.data), baseUrl, idLive, info.swap || {}, '/api/proxy');

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(rewritten);
    } catch (err: unknown) {
      streamCache.del(cacheKey);
      const msg = err instanceof Error ? err.message : 'Upstream stream error';
      res.status(500).send(msg);
    }
  });

  // 8. Subplaylist & Generic M3U8 Proxy Route
  app.get(['/api/proxy/subplaylist', '/api/proxy/m3u8'], async (req, res) => {
    const targetUrl = String(req.query.u || '');
    const idLive = String(req.query.id || 'generic');
    if (!targetUrl || !isValidStreamUrl(targetUrl)) {
      res.status(400).send('Invalid or restricted target URL');
      return;
    }

    const info = streamCache.get<ResolvedFgStream>(idLive);
    const reqHeaders: Record<string, string> = { ...(info?.headers || {}) };
    if (info?.agent) reqHeaders['User-Agent'] = info.agent;

    try {
      const controller = new AbortController();
      res.on('close', () => {
        controller.abort();
      });

      const response = await axios.get(targetUrl, {
        headers: reqHeaders,
        timeout: 10000,
        responseType: 'text',
        signal: controller.signal,
      });
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
      const rewritten = rewriteM3u8WithSwap(String(response.data), baseUrl, idLive, info?.swap || {}, '/api/proxy');

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(rewritten);
    } catch (err: unknown) {
      if (!res.headersSent) {
        const msg = err instanceof Error ? err.message : 'Failed to proxy subplaylist';
        res.status(502).send(msg);
      }
    }
  });

  // 9. MPEG-TS / fMP4 Video Segment Stream Pipe with Abort & Socket Teardown (/api/proxy/ts)
  app.get('/api/proxy/ts', async (req, res) => {
    const targetUrl = String(req.query.u || '');
    const idLive = String(req.query.id || 'generic');
    if (!targetUrl || !isValidStreamUrl(targetUrl)) {
      res.status(400).end();
      return;
    }

    const info = streamCache.get<ResolvedFgStream>(idLive);
    const reqHeaders: Record<string, string> = { ...(info?.headers || {}) };
    if (info?.agent) reqHeaders['User-Agent'] = info.agent;

    try {
      const controller = new AbortController();
      res.on('close', () => {
        controller.abort();
      });

      const streamResp = await axios.get(targetUrl, {
        headers: reqHeaders,
        responseType: 'stream',
        timeout: 15000,
        signal: controller.signal,
      });

      res.status(streamResp.status);
      res.setHeader('Content-Type', String(streamResp.headers['content-type'] || 'video/mp2t'));
      res.setHeader('Access-Control-Allow-Origin', '*');

      res.on('close', () => {
        if (streamResp.data && !streamResp.data.destroyed) {
          streamResp.data.destroy();
        }
      });

      streamResp.data.pipe(res);
    } catch {
      if (!res.headersSent) {
        res.status(502).end();
      }
    }
  });

  // 10. Xtream Codes Account Authentication Endpoint (Protected by authLimiter)
  app.post('/api/xtream/authenticate', authLimiter, async (req, res) => {
    try {
      let { host = '', username = '', password = '' } = req.body || {};
      host = String(host).trim().replace(/\/+$/, '');
      username = String(username).trim();
      password = String(password).trim();

      if (!host || !username || !password) {
        res.status(400).json({
          success: false,
          error: 'يرجى إدخال عنوان السيرفر، اسم المستخدم، وكلمة المرور.',
        });
        return;
      }

      if (!/^https?:\/\//i.test(host)) {
        host = `http://${host}`;
      }

      if (!isValidStreamUrl(host)) {
        res.status(400).json({ success: false, error: 'عنوان السيرفر المدخل غير صالح أو محظور.' });
        return;
      }

      const authUrl = `${host}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
      const resp = await axios.get(authUrl, { timeout: 12000, responseType: 'json' });
      const data = resp.data;

      if (!data || typeof data !== 'object') {
        res.status(400).json({ success: false, error: 'استجابة غير صالحة من سيرفر Xtream' });
        return;
      }

      const userInfo = data.user_info;
      if (!userInfo || userInfo.auth === 0 || userInfo.status !== 'Active') {
        const errorDetail = userInfo?.message || 'فشل المصادقة — الحساب غير نشط أو البيانات غير صحيحة';
        res.status(401).json({ success: false, error: errorDetail });
        return;
      }

      let expDateFormatted = 'غير محدد';
      if (userInfo.exp_date && !isNaN(Number(userInfo.exp_date))) {
        const d = new Date(Number(userInfo.exp_date) * 1000);
        expDateFormatted = d.toISOString().split('T')[0];
      }

      res.json({
        success: true,
        userInfo: {
          username: userInfo.username,
          status: userInfo.status,
          expDate: expDateFormatted,
          maxConnections: userInfo.max_connections || '1',
          activeCons: userInfo.active_cons || '0',
          isTrial: userInfo.is_trial === '1',
        },
        serverInfo: data.server_info || {},
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر الاتصال بسيرفر Xtream Codes';
      res.status(500).json({ success: false, error: msg });
    }
  });

  // 11. Xtream Codes Sync Catalog (Live + VOD + Series)
  app.post('/api/xtream/sync', async (req, res) => {
    try {
      let { host = '', username = '', password = '', playlistName = '', includeVod = true, includeSeries = true } = req.body || {};
      host = String(host).trim().replace(/\/+$/, '');
      username = String(username).trim();
      password = String(password).trim();

      if (!host || !username || !password) {
        res.status(400).json({ success: false, error: 'البيانات غير مكتملة' });
        return;
      }

      if (!/^https?:\/\//i.test(host)) {
        host = `http://${host}`;
      }

      if (!isValidStreamUrl(host)) {
        res.status(400).json({ success: false, error: 'عنوان السيرفر المدخل غير صالح أو محظور.' });
        return;
      }

      const playlistId = `xtream-${Buffer.from(`${host}:::${username}`).toString('hex').slice(0, 10)}`;
      const baseApi = `${host}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

      // 1. Verify user info
      const authResp = await axios.get(baseApi, { timeout: 12000 });
      const userInfo = authResp.data?.user_info;
      if (!userInfo || userInfo.auth === 0) {
        res.status(401).json({ success: false, error: 'بيانات الدخول غير صحيحة أو تم إيقاف الحساب' });
        return;
      }

      const categories: CategoryItem[] = [];
      const channels: ChannelItem[] = [];

      // 2. Fetch Live categories and streams
      try {
        const [liveCatsResp, liveStreamsResp] = await Promise.all([
          axios.get(`${baseApi}&action=get_live_categories`, { timeout: 15000 }),
          axios.get(`${baseApi}&action=get_live_streams`, { timeout: 25000 }),
        ]);

        const rawLiveCats = Array.isArray(liveCatsResp.data) ? liveCatsResp.data : [];
        const rawLiveStreams = Array.isArray(liveStreamsResp.data) ? liveStreamsResp.data : [];
        const liveCatCounts = new Map<string, number>();

        for (const stream of rawLiveStreams) {
          const catId = String(stream.category_id || '0');
          liveCatCounts.set(catId, (liveCatCounts.get(catId) || 0) + 1);

          const streamId = stream.stream_id;
          const directStreamUrl = `${host}/live/${username}/${password}/${streamId}.m3u8`;

          channels.push({
            id: `xtream-live-${streamId}`,
            playlistId,
            categoryId: `xtream-cat-${catId}`,
            name: stream.name || `قناة ${streamId}`,
            groupTitle: 'بث مباشر',
            section: 'live',
            logo: stream.stream_icon || '',
            resolution: stream.resolution || 'HD',
            sources: [
              {
                id: `srv-xtream-live-1`,
                name: 'سيرفر Xtream الأصلي (مباشر)',
                url: directStreamUrl,
              },
              {
                id: `srv-xtream-live-2`,
                name: 'سيرفر بروكسي ARN المحلي (تجاوز القيود)',
                url: `/api/proxy/m3u8?u=${encodeURIComponent(directStreamUrl)}`,
                isProxied: true,
              },
            ],
          });
        }

        for (const cat of rawLiveCats) {
          const cId = String(cat.category_id);
          const count = liveCatCounts.get(cId) || 0;
          categories.push({
            id: `xtream-cat-${cId}`,
            playlistId,
            name: cat.category_name || 'باقة مباشرة',
            section: 'live',
            count,
          });
        }
      } catch (liveErr) {
        console.warn('[Xtream] Warning fetching live streams:', liveErr instanceof Error ? liveErr.message : 'Unknown network error');
      }

      // 3. Fetch VOD Movies (if requested)
      if (includeVod) {
        try {
          const [vodCatsResp, vodStreamsResp] = await Promise.all([
            axios.get(`${baseApi}&action=get_vod_categories`, { timeout: 15000 }),
            axios.get(`${baseApi}&action=get_vod_streams`, { timeout: 25000 }),
          ]);

          const rawVodCats = Array.isArray(vodCatsResp.data) ? vodCatsResp.data : [];
          const rawVodStreams = Array.isArray(vodStreamsResp.data) ? vodStreamsResp.data : [];
          const vodCatCounts = new Map<string, number>();

          for (const movie of rawVodStreams) {
            const catId = String(movie.category_id || '0');
            vodCatCounts.set(catId, (vodCatCounts.get(catId) || 0) + 1);

            const streamId = movie.stream_id;
            const ext = movie.container_extension || 'mp4';
            const directUrl = `${host}/movie/${username}/${password}/${streamId}.${ext}`;

            channels.push({
              id: `xtream-vod-${streamId}`,
              playlistId,
              categoryId: `xtream-vod-cat-${catId}`,
              name: movie.name || `فيلم ${streamId}`,
              groupTitle: 'أفلام VOD',
              section: 'movies',
              logo: movie.stream_icon || '',
              rating: movie.rating ? String(movie.rating) : undefined,
              sources: [
                {
                  id: `srv-xtream-vod-1`,
                  name: 'سيرفر الفيلم الأصلي (VOD)',
                  url: directUrl,
                },
                {
                  id: `srv-xtream-vod-2`,
                  name: 'سيرفر البروكسي المحلي',
                  url: `/api/proxy/ts?u=${encodeURIComponent(directUrl)}`,
                  isProxied: true,
                },
              ],
            });
          }

          for (const cat of rawVodCats) {
            const cId = String(cat.category_id);
            const count = vodCatCounts.get(cId) || 0;
            categories.push({
              id: `xtream-vod-cat-${cId}`,
              playlistId,
              name: cat.category_name || 'باقة أفلام',
              section: 'movies',
              count,
            });
          }
        } catch (vodErr) {
          console.warn('[Xtream] Warning fetching VOD:', vodErr instanceof Error ? vodErr.message : 'Unknown network error');
        }
      }

      // 4. Fetch Series (if requested)
      if (includeSeries) {
        try {
          const [seriesCatsResp, seriesListResp] = await Promise.all([
            axios.get(`${baseApi}&action=get_series_categories`, { timeout: 15000 }),
            axios.get(`${baseApi}&action=get_series`, { timeout: 25000 }),
          ]);

          const rawSeriesCats = Array.isArray(seriesCatsResp.data) ? seriesCatsResp.data : [];
          const rawSeriesList = Array.isArray(seriesListResp.data) ? seriesListResp.data : [];
          const seriesCatCounts = new Map<string, number>();

          for (const item of rawSeriesList) {
            const catId = String(item.category_id || '0');
            seriesCatCounts.set(catId, (seriesCatCounts.get(catId) || 0) + 1);

            const seriesId = item.series_id;
            channels.push({
              id: `xtream-series-${seriesId}`,
              playlistId,
              categoryId: `xtream-series-cat-${catId}`,
              name: item.name || `مسلسل ${seriesId}`,
              groupTitle: 'مسلسلات Series',
              section: 'series',
              logo: item.cover || '',
              rating: item.rating ? String(item.rating) : undefined,
              year: item.releaseDate ? String(item.releaseDate).slice(0, 4) : undefined,
              sources: [
                {
                  id: `srv-xtream-series-1`,
                  name: 'سيرفر المسلسل',
                  url: `${host}/series/${username}/${password}/${seriesId}`,
                },
              ],
            });
          }

          for (const cat of rawSeriesCats) {
            const cId = String(cat.category_id);
            const count = seriesCatCounts.get(cId) || 0;
            categories.push({
              id: `xtream-series-cat-${cId}`,
              playlistId,
              name: cat.category_name || 'باقة مسلسلات',
              section: 'series',
              count,
            });
          }
        } catch (seriesErr) {
          console.warn('[Xtream] Warning fetching Series:', seriesErr instanceof Error ? seriesErr.message : 'Unknown network error');
        }
      }

      const totalChannels = channels.length;
      const finalName = playlistName.trim() || `اشتراك Xtream (${userInfo.username})`;

      res.json({
        success: true,
        playlist: {
          id: playlistId,
          name: finalName,
          type: 'xtream',
          codeOrUrl: host,
          channelCount: totalChannels,
          updatedAt: new Date().toISOString().split('T')[0],
        },
        accountInfo: {
          username: userInfo.username,
          status: userInfo.status,
          expDate: userInfo.exp_date && !isNaN(Number(userInfo.exp_date))
            ? new Date(Number(userInfo.exp_date) * 1000).toISOString().split('T')[0]
            : 'غير محدد',
          maxConnections: userInfo.max_connections || '1',
        },
        categories,
        channels,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر مزامنة واستيراد حساب Xtream Codes';
      res.status(500).json({ success: false, error: msg });
    }
  });

  // Mount Vite Dev Server or Production Static Build
  const distPath = customDistPath || path.join(_dirname, 'dist');
  if (process.env.NODE_ENV === 'production' || customDistPath || typeof createViteServer !== 'function') {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  return new Promise((resolve, reject) => {
    const srv = app.listen(customPort, '127.0.0.1', () => {
      console.log(`[ARN IPTV Pro Server & Stream Proxy] Listening on http://127.0.0.1:${customPort}`);
      resolve({
        port: customPort,
        close: () => srv.close(),
      });
    });

    srv.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[ARN IPTV Pro] Port ${customPort} in use, shifting to ${customPort + 1}...`);
        startServer(customPort + 1, customDistPath).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

// Auto-start only when directly invoked via CLI (not when required by Electron main)
const isDirectCli =
  typeof require !== 'undefined' && typeof module !== 'undefined'
    ? require.main === module
    : process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js');

if (isDirectCli && process.env.ELECTRON_RUN !== 'true') {
  startServer(PORT).catch((err) => {
    console.error('Fatal Server Startup Error:', err);
  });
}
