'use strict';

/**
 * ARN IPTV Pro — Local HLS / MPEG-TS Stream Proxy & k9x_ Swap Engine
 * Copyright © 2026 عبده رجب نصار — شركة ARN Technology
 *
 * Features:
 * - Resolves Drama Live (FG) streams via `fg_engine.js` with TTL caching
 * - Rewrites Master & Media M3U8 playlists (`/live`, `/subplaylist`, `/ext/playlist.m3u8`)
 * - Strips/replaces `k9x_` segment obfuscation via `swap` rules
 * - Rewrites `#EXT-X-KEY` and `#EXT-X-MAP` tags for encrypted/fMP4 HLS
 * - Aborts upstream HTTP streams immediately on channel switch (`AbortController`)
 * - Supports HTTP Range requests (`206 Partial Content`) on `/direct` for VOD MP4/MKV
 * - Serves built-in 4-level Adaptive HLS (1080p/720p/480p/360p) & FG k9x_ loopback streams
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const axios = require('axios');
const { resolveFgStream } = require('./fg_engine');

const DEFAULT_PROXY_PORT = 39871;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const streamCache = new Map(); // cacheKey -> { info, expiresAt }

const DEMO_ASSETS_DIR = path.resolve(__dirname, '..', 'renderer', 'assets', 'demo');
const ALLOWED_QUALITIES = new Set(['1080p', '720p', '480p', '360p']);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Origin, Accept, Content-Type, X-Requested-With',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type'
};

/**
 * Validates that an upstream URL uses safe HTTP/HTTPS protocol.
 */
function isSafeHttpUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_e) {
    return false;
  }
}

/**
 * Applies `swap` dictionary (e.g. `{ "k9x_": "" }`) to a segment or URI string.
 */
function applySwapRules(input, swap) {
  if (!input || !swap || typeof swap !== 'object') return input;
  let result = input;
  for (const [k, v] of Object.entries(swap)) {
    if (k) {
      result = result.split(k).join(String(v ?? ''));
    }
  }
  return result;
}

/**
 * Rewrites `URI="..."` attribute inside `#EXT-X-KEY`, `#EXT-X-MAP`, or `#EXT-X-MEDIA` tags.
 */
function rewriteTagUri(tagLine, baseUrl, swap, buildProxyUrl) {
  if (!tagLine.includes('URI="')) return tagLine;
  return tagLine.replace(/URI="([^"]+)"/g, (_full, rawUri) => {
    const swapped = applySwapRules(rawUri.trim(), swap);
    let absUri;
    try {
      absUri = new URL(swapped, baseUrl).href;
    } catch (_e) {
      return _full;
    }
    if (tagLine.startsWith('#EXT-X-KEY')) {
      return `URI="${buildProxyUrl('/key', absUri)}"`;
    }
    if (tagLine.startsWith('#EXT-X-MEDIA') || absUri.toLowerCase().includes('.m3u8')) {
      return `URI="${buildProxyUrl('/subplaylist', absUri)}"`;
    }
    return `URI="${buildProxyUrl('/ts', absUri)}"`;
  });
}

/**
 * Rewrites all lines of an M3U8 manifest (both Master and Media playlists),
 * stripping `k9x_` swap tokens and routing subplaylists, keys, and TS segments
 * through the local proxy.
 */
function rewriteM3u8Manifest(m3u8Text, finalStreamUrl, swap, buildProxyUrl) {
  const slashIdx = finalStreamUrl.lastIndexOf('/');
  const baseUrl = slashIdx !== -1 ? finalStreamUrl.slice(0, slashIdx + 1) : finalStreamUrl;
  const lines = String(m3u8Text || '').split(/\r?\n/);

  const rewritten = lines.map((rawLine) => {
    const line = rawLine.trim();
    if (!line) return '';

    if (line.startsWith('#')) {
      return rewriteTagUri(line, baseUrl, swap, buildProxyUrl);
    }

    const cleanRef = applySwapRules(line, swap);
    let fullUrl;
    try {
      fullUrl = new URL(cleanRef, baseUrl).href;
    } catch (_e) {
      return line;
    }

    // Check if line points to a variant / chunklist M3U8 playlist
    const pathPart = fullUrl.split('?')[0].toLowerCase();
    if (pathPart.endsWith('.m3u8') || cleanRef.toLowerCase().includes('.m3u8')) {
      return buildProxyUrl('/subplaylist', fullUrl);
    }

    return buildProxyUrl('/ts', fullUrl);
  });

  return rewritten.join('\n');
}

/**
 * Builds upstream request headers from cached FG descriptor or custom query params.
 */
function buildUpstreamHeaders(info = {}, extraQuery = {}, incomingRange = '') {
  const headers = { ...(info.headers || {}) };
  if (info.agent) {
    headers['User-Agent'] = info.agent;
  } else if (extraQuery.ua) {
    headers['User-Agent'] = String(extraQuery.ua);
  } else if (!headers['User-Agent']) {
    headers['User-Agent'] = 'VLC/3.0.20 LibVLC/3.0.20';
  }

  if (extraQuery.ref && !headers.Referer) {
    headers.Referer = String(extraQuery.ref);
  }
  if (extraQuery.org && !headers.Origin) {
    headers.Origin = String(extraQuery.org);
  }
  if (incomingRange) {
    headers.Range = incomingRange;
  }
  return headers;
}

/**
 * Retrieves or resolves an FG channel stream descriptor with TTL caching.
 */
async function getOrResolveFgInfo(code, idLive, serverIndex, proxyPort) {
  const cacheKey = `${code}::${idLive}::${serverIndex}`;
  const cached = streamCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { cacheKey, info: cached.info };
  }
  const info = await resolveFgStream(code, idLive, serverIndex, { proxyPort });
  if (info && info.streamUrl) {
    streamCache.set(cacheKey, {
      info,
      expiresAt: Date.now() + CACHE_TTL_MS
    });
  }
  return { cacheKey, info };
}

/**
 * Generates a 4-level Adaptive HLS Master Playlist (`1080p`, `720p`, `480p`, `360p`).
 */
function buildDemoMasterM3u8(prefixUrl) {
  return [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-INDEPENDENT-SEGMENTS',
    '#EXT-X-STREAM-INF:BANDWIDTH=2650000,AVERAGE-BANDWIDTH=2300000,RESOLUTION=1920x1080,FRAME-RATE=25.000,CODECS="avc1.42c028,mp4a.40.2",NAME="1080p FHD"',
    `${prefixUrl}/1080p/index.m3u8`,
    '#EXT-X-STREAM-INF:BANDWIDTH=1450000,AVERAGE-BANDWIDTH=1280000,RESOLUTION=1280x720,FRAME-RATE=25.000,CODECS="avc1.42c01f,mp4a.40.2",NAME="720p HD"',
    `${prefixUrl}/720p/index.m3u8`,
    '#EXT-X-STREAM-INF:BANDWIDTH=820000,AVERAGE-BANDWIDTH=720000,RESOLUTION=854x480,FRAME-RATE=25.000,CODECS="avc1.42c01e,mp4a.40.2",NAME="480p SD"',
    `${prefixUrl}/480p/index.m3u8`,
    '#EXT-X-STREAM-INF:BANDWIDTH=480000,AVERAGE-BANDWIDTH=420000,RESOLUTION=640x360,FRAME-RATE=25.000,CODECS="avc1.42c01e,mp4a.40.2",NAME="360p Low"',
    `${prefixUrl}/360p/index.m3u8`
  ].join('\n');
}

/**
 * Generates a continuous Live sliding-window HLS media playlist (advances every 2s)
 * or a seekable 60-second VOD playlist from our 3 compact `.ts` segments.
 */
function buildDemoVariantM3u8(segmentPrefixUrl, { isVod = false, obfuscatePrefix = '' } = {}) {
  if (isVod) {
    const lines = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-PLAYLIST-TYPE:VOD'
    ];
    // 30 segments * 2.0s = 60 seconds seekable VOD movie/episode
    for (let i = 0; i < 30; i++) {
      if (i > 0 && i % 3 === 0) {
        lines.push('#EXT-X-DISCONTINUITY');
      }
      const segIdx = String(i % 3).padStart(2, '0');
      lines.push('#EXTINF:2.000,');
      lines.push(`${segmentPrefixUrl}/${obfuscatePrefix}seg_${segIdx}.ts?seq=${i}`);
    }
    lines.push('#EXT-X-ENDLIST');
    return lines.join('\n');
  }

  // Sliding Live Broadcast Window (6 segments visible, sequence advances every 2s)
  const baseSeq = Math.floor(Date.now() / 2000) % 100000;
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-TARGETDURATION:3',
    `#EXT-X-MEDIA-SEQUENCE:${baseSeq}`
  ];

  for (let offset = 0; offset < 6; offset++) {
    const seq = baseSeq + offset;
    const idx = seq % 3;
    if (offset > 0 && idx === 0) {
      lines.push('#EXT-X-DISCONTINUITY');
    }
    const segIdx = String(idx).padStart(2, '0');
    lines.push('#EXTINF:2.000,');
    lines.push(`${segmentPrefixUrl}/${obfuscatePrefix}seg_${segIdx}.ts?seq=${seq}`);
  }

  return lines.join('\n');
}

/**
 * Serves a local demo MPEG-TS segment (`seg_00.ts`, `seg_01.ts`, `seg_02.ts`).
 */
function serveDemoSegment(res, quality, segFileName) {
  if (!ALLOWED_QUALITIES.has(quality)) {
    res.writeHead(404, CORS_HEADERS);
    return res.end('Unknown quality');
  }
  // IMPORTANT: Obfuscated `k9x_seg_00.ts` intentionally returns 404 unless `k9x_` was stripped!
  if (!/^seg_0[0-2]\.ts$/.test(segFileName)) {
    res.writeHead(404, CORS_HEADERS);
    return res.end('Segment not found (k9x_ swap required)');
  }
  const filePath = path.join(DEMO_ASSETS_DIR, quality, segFileName);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, CORS_HEADERS);
    return res.end('Demo segment missing');
  }
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    ...CORS_HEADERS,
    'Content-Type': 'video/mp2t',
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache'
  });
  fs.createReadStream(filePath).pipe(res);
}

/**
 * Core HTTP request handler for both standalone `127.0.0.1:39871` Electron proxy
 * and mounted `/proxy` Web Preview bridge.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {{ proxyPort?: number, mountPrefix?: string, publicBaseUrl?: string }} [ctx]
 */
async function handleProxyRequest(req, res, ctx = {}) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  const proxyPort = ctx.proxyPort || DEFAULT_PROXY_PORT;
  const mountPrefix = ctx.mountPrefix || ''; // e.g. '' in Electron, '/proxy' in Web Preview

  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, `http://127.0.0.1:${proxyPort}`);
  } catch (_e) {
    res.writeHead(400, CORS_HEADERS);
    return res.end('Bad URL');
  }

  let routePath = parsedUrl.pathname;
  if (mountPrefix && routePath.startsWith(mountPrefix)) {
    routePath = routePath.slice(mountPrefix.length) || '/';
  }
  const query = Object.fromEntries(parsedUrl.searchParams.entries());

  // Determine how rewritten M3U8 URLs should be formatted:
  // - When mounted under `/proxy` in Web Preview, emit root-relative `/proxy/...` URLs
  //   so browser clients NEVER call 127.0.0.1 directly!
  // - In standalone Electron (`file://` renderer talking to `http://127.0.0.1:39871`),
  //   emit `http://127.0.0.1:39871/...` URLs.
  const proxyOrigin = mountPrefix
    ? mountPrefix
    : (ctx.publicBaseUrl || `http://127.0.0.1:${proxyPort}`);

  // 1. Health Check: /ping
  if (routePath === '/ping') {
    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('pong');
  }

  // 2. Simulated Failover Endpoint: /demo/fail/*
  if (routePath.startsWith('/demo/fail/')) {
    res.writeHead(503, { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Simulated upstream server outage (Auto-Failover test)');
  }

  // 3. Built-in Multi-Quality Live & VOD Demo Streams: /demo/(live|vod)/:channelId/...
  const demoMatch = routePath.match(/^\/demo\/(live|vod)\/([^/]+)\/(.+)$/);
  if (demoMatch) {
    const [, mode, chSlug, rest] = demoMatch;
    const isVod = mode === 'vod';
    const baseChUrl = `${proxyOrigin}/demo/${mode}/${encodeURIComponent(chSlug)}`;

    if (rest === 'master.m3u8') {
      const body = Buffer.from(buildDemoMasterM3u8(baseChUrl), 'utf8');
      res.writeHead(200, {
        ...CORS_HEADERS,
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Content-Length': body.length,
        'Cache-Control': 'no-cache'
      });
      return res.end(body);
    }

    const varMatch = rest.match(/^(1080p|720p|480p|360p)\/(.+)$/);
    if (varMatch) {
      const [, q, filePart] = varMatch;
      if (filePart === 'index.m3u8') {
        const m3u8 = buildDemoVariantM3u8(`${baseChUrl}/${q}`, { isVod });
        const body = Buffer.from(m3u8, 'utf8');
        res.writeHead(200, {
          ...CORS_HEADERS,
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Content-Length': body.length,
          'Cache-Control': 'no-cache'
        });
        return res.end(body);
      }
      return serveDemoSegment(res, q, filePart);
    }
  }

  // 4. Built-in FG Upstream Loopback (with real `k9x_` segment obfuscation!): /__fg_upstream/:id/...
  const fgUpMatch = routePath.match(/^\/__fg_upstream\/([^/]+)\/(.+)$/);
  if (fgUpMatch) {
    const [, fgId, rest] = fgUpMatch;
    const upstreamBase = `http://127.0.0.1:${proxyPort}/__fg_upstream/${encodeURIComponent(fgId)}`;

    if (rest === 'master.m3u8') {
      const body = Buffer.from(buildDemoMasterM3u8(upstreamBase), 'utf8');
      res.writeHead(200, {
        ...CORS_HEADERS,
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Content-Length': body.length,
        'Cache-Control': 'no-cache'
      });
      return res.end(body);
    }

    const varMatch = rest.match(/^(1080p|720p|480p|360p)\/(.+)$/);
    if (varMatch) {
      const [, q, filePart] = varMatch;
      if (filePart === 'index.m3u8') {
        // Emit segments with `k9x_` prefix so `stream_proxy.js` MUST strip `k9x_` via swap!
        const m3u8 = buildDemoVariantM3u8(`${upstreamBase}/${q}`, {
          isVod: false,
          obfuscatePrefix: 'k9x_'
        });
        const body = Buffer.from(m3u8, 'utf8');
        res.writeHead(200, {
          ...CORS_HEADERS,
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Content-Length': body.length,
          'Cache-Control': 'no-cache'
        });
        return res.end(body);
      }
      return serveDemoSegment(res, q, filePart);
    }
  }

  // 5. Drama Live FG Channel Entry: /live/:id(.m3u8)?code=...&srv=0
  if (routePath.startsWith('/live/')) {
    const idLive = decodeURIComponent(
      routePath.slice('/live/'.length).replace(/\.m3u8$/i, '')
    ).trim();
    const code = query.code || '202122';
    const srv = Math.max(0, parseInt(query.srv || '0', 10) || 0);

    if (!idLive) {
      res.writeHead(400, CORS_HEADERS);
      return res.end('Missing channel ID');
    }

    let cacheKey = '';
    try {
      const resolved = await getOrResolveFgInfo(code, idLive, srv, proxyPort);
      cacheKey = resolved.cacheKey;
      const info = resolved.info;

      if (!info || !info.streamUrl || !isSafeHttpUrl(info.streamUrl)) {
        res.writeHead(404, CORS_HEADERS);
        return res.end('Channel stream not found');
      }

      const reqHeaders = buildUpstreamHeaders(info);
      const response = await axios.get(info.streamUrl, {
        headers: reqHeaders,
        responseType: 'text',
        timeout: 12000
      });

      const finalUrl = response.request?.res?.responseUrl || info.streamUrl;
      const buildProxyUrl = (endpoint, targetUrl) =>
        `${proxyOrigin}${endpoint}?id=${encodeURIComponent(idLive)}&code=${encodeURIComponent(code)}&srv=${srv}&u=${encodeURIComponent(targetUrl)}`;

      const rewrittenM3u8 = rewriteM3u8Manifest(
        response.data,
        finalUrl,
        info.swap || {},
        buildProxyUrl
      );

      const body = Buffer.from(rewrittenM3u8, 'utf8');
      res.writeHead(200, {
        ...CORS_HEADERS,
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Content-Length': body.length,
        'Cache-Control': 'no-cache'
      });
      return res.end(body);
    } catch (err) {
      if (cacheKey) streamCache.delete(cacheKey);
      res.writeHead(502, { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(`Upstream FG Stream Error: ${err.message}`);
    }
  }

  // 6. Variant / Chunklist M3U8 Subplaylist: /subplaylist?id=...&u=... (or external M3U8 /ext/playlist.m3u8)
  if (routePath === '/subplaylist' || routePath === '/ext/playlist.m3u8') {
    const targetUrl = query.u;
    if (!isSafeHttpUrl(targetUrl)) {
      res.writeHead(400, CORS_HEADERS);
      return res.end('Invalid upstream playlist URL');
    }

    const idLive = query.id || '';
    const code = query.code || '202122';
    const srv = Math.max(0, parseInt(query.srv || '0', 10) || 0);
    const cacheKey = `${code}::${idLive}::${srv}`;
    const info = idLive ? streamCache.get(cacheKey)?.info || {} : {};

    try {
      const reqHeaders = buildUpstreamHeaders(info, query);
      const response = await axios.get(targetUrl, {
        headers: reqHeaders,
        responseType: 'text',
        timeout: 12000
      });

      const finalUrl = response.request?.res?.responseUrl || targetUrl;
      const extraParams = [];
      if (idLive) extraParams.push(`id=${encodeURIComponent(idLive)}`, `code=${encodeURIComponent(code)}`, `srv=${srv}`);
      if (query.ua) extraParams.push(`ua=${encodeURIComponent(query.ua)}`);
      if (query.ref) extraParams.push(`ref=${encodeURIComponent(query.ref)}`);
      if (query.org) extraParams.push(`org=${encodeURIComponent(query.org)}`);
      const paramStr = extraParams.length > 0 ? `${extraParams.join('&')}&` : '';

      const buildProxyUrl = (endpoint, nextUrl) =>
        `${proxyOrigin}${endpoint}?${paramStr}u=${encodeURIComponent(nextUrl)}`;

      const rewrittenM3u8 = rewriteM3u8Manifest(
        response.data,
        finalUrl,
        info.swap || {},
        buildProxyUrl
      );

      const body = Buffer.from(rewrittenM3u8, 'utf8');
      res.writeHead(200, {
        ...CORS_HEADERS,
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Content-Length': body.length,
        'Cache-Control': 'no-cache'
      });
      return res.end(body);
    } catch (err) {
      res.writeHead(502, { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(`Subplaylist Error: ${err.message}`);
    }
  }

  // 7. HLS AES-128 Key, Media Segments (/ts), and Direct VOD Streams (/direct)
  if (routePath === '/ts' || routePath === '/key' || routePath === '/direct') {
    const targetUrl = query.u;
    if (!isSafeHttpUrl(targetUrl)) {
      res.writeHead(400, CORS_HEADERS);
      return res.end('Invalid media URL');
    }

    const idLive = query.id || '';
    const code = query.code || '202122';
    const srv = Math.max(0, parseInt(query.srv || '0', 10) || 0);
    const cacheKey = `${code}::${idLive}::${srv}`;
    const info = idLive ? streamCache.get(cacheKey)?.info || {} : {};

    const abortController = new AbortController();
    req.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    try {
      const reqHeaders = buildUpstreamHeaders(info, query, req.headers.range || '');
      const streamResp = await axios.get(targetUrl, {
        headers: reqHeaders,
        responseType: 'stream',
        timeout: routePath === '/direct' ? 25000 : 15000,
        signal: abortController.signal,
        validateStatus: (status) => status >= 200 && status < 400
      });

      const outHeaders = {
        ...CORS_HEADERS,
        'Content-Type':
          streamResp.headers['content-type'] ||
          (routePath === '/key'
            ? 'application/octet-stream'
            : routePath === '/direct'
              ? 'video/mp4'
              : 'video/mp2t')
      };

      if (streamResp.headers['content-length']) {
        outHeaders['Content-Length'] = streamResp.headers['content-length'];
      }
      if (streamResp.headers['content-range']) {
        outHeaders['Content-Range'] = streamResp.headers['content-range'];
      }
      if (streamResp.headers['accept-ranges']) {
        outHeaders['Accept-Ranges'] = streamResp.headers['accept-ranges'];
      }

      res.writeHead(streamResp.status, outHeaders);
      streamResp.data.on('error', () => {
        if (!res.writableEnded) res.end();
      });
      streamResp.data.pipe(res);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(502, CORS_HEADERS);
        res.end();
      }
    }
    return;
  }

  res.writeHead(404, CORS_HEADERS);
  res.end('Not Found');
}

/**
 * Resolves a stored stream descriptor (`fg://...`, `demo://...`, or `http(s)://...`)
 * into an actionable playback URL bound to the active proxy base URL.
 *
 * @param {string} rawStreamUrl
 * @param {object} [headers]
 * @param {string} [agent]
 * @param {string} [proxyBase] - e.g. `http://127.0.0.1:39871` or `/proxy`
 * @returns {string}
 */
function resolvePlayableUrl(rawStreamUrl, headers = {}, agent = '', proxyBase = `http://127.0.0.1:${DEFAULT_PROXY_PORT}`) {
  const raw = String(rawStreamUrl || '').trim();
  if (!raw) return '';

  // 1. Drama Live FG URI: fg://<id>?code=<code>&srv=<srv>
  if (raw.startsWith('fg://')) {
    const withoutScheme = raw.slice(5);
    const qIdx = withoutScheme.indexOf('?');
    const chId = qIdx !== -1 ? withoutScheme.slice(0, qIdx) : withoutScheme;
    const qs = qIdx !== -1 ? withoutScheme.slice(qIdx) : '?code=202122&srv=0';
    return `${proxyBase}/live/${encodeURIComponent(chId)}.m3u8${qs}`;
  }

  // 2. Demo Showcase URI: demo://live/<slug>?srv=1 | demo://vod/<slug> | demo://fail/<slug>
  if (raw.startsWith('demo://')) {
    const withoutScheme = raw.slice(7);
    const [pathPart, qsPart] = withoutScheme.split('?');
    if (pathPart.startsWith('fail/')) {
      return `${proxyBase}/demo/${pathPart}${qsPart ? `?${qsPart}` : ''}`;
    }
    return `${proxyBase}/demo/${pathPart}/master.m3u8${qsPart ? `?${qsPart}` : ''}`;
  }

  // 3. Direct localhost proxy URL emitted by older configs -> rewrite host to active proxyBase
  const localMatch = raw.match(/^https?:\/\/127\.0\.0\.1:\d+(\/.*)$/);
  if (localMatch) {
    return `${proxyBase}${localMatch[1]}`;
  }

  // 4. External HTTP/HTTPS M3U8 or Direct VOD stream -> route through local proxy
  //    so custom User-Agent / Referer headers and CORS AudioContext 200% boost always work!
  if (/^https?:\/\//i.test(raw)) {
    const params = new URLSearchParams();
    params.set('u', raw);
    if (agent) params.set('ua', agent);
    if (headers && headers.Referer) params.set('ref', headers.Referer);
    if (headers && headers.Origin) params.set('org', headers.Origin);

    const pathOnly = raw.split('?')[0].toLowerCase();
    if (pathOnly.endsWith('.mp4') || pathOnly.endsWith('.mkv') || pathOnly.endsWith('.avi')) {
      return `${proxyBase}/direct?${params.toString()}`;
    }
    if (pathOnly.endsWith('.ts') && !pathOnly.endsWith('.m3u8')) {
      return `${proxyBase}/direct?${params.toString()}`;
    }
    return `${proxyBase}/ext/playlist.m3u8?${params.toString()}`;
  }

  return raw;
}

/**
 * Starts the standalone local HTTP stream proxy server on `127.0.0.1`.
 * Automatically falls back to an available OS port if `39871` is occupied.
 *
 * @param {number} [preferredPort=39871]
 * @returns {Promise<{ server: http.Server, port: number, baseUrl: string }>}
 */
function startStreamProxy(preferredPort = DEFAULT_PROXY_PORT) {
  return new Promise((resolve, reject) => {
    let activePort = preferredPort;
    const server = http.createServer((req, res) => {
      handleProxyRequest(req, res, { proxyPort: activePort });
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && activePort === preferredPort) {
        server.listen(0, '127.0.0.1');
      } else {
        reject(err);
      }
    });

    server.listen(preferredPort, '127.0.0.1', () => {
      const addr = server.address();
      activePort = typeof addr === 'object' && addr ? addr.port : preferredPort;
      const baseUrl = `http://127.0.0.1:${activePort}`;
      console.log(`[ARN Proxy] Running on ${baseUrl}`);
      resolve({ server, port: activePort, baseUrl });
    });
  });
}

function clearStreamCache() {
  streamCache.clear();
}

module.exports = {
  DEFAULT_PROXY_PORT,
  CORS_HEADERS,
  applySwapRules,
  rewriteM3u8Manifest,
  resolvePlayableUrl,
  handleProxyRequest,
  startStreamProxy,
  clearStreamCache
};
