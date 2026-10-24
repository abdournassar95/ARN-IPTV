'use strict';

/**
 * ARN IPTV Pro — High-Speed M3U / M3U8, Xtream Codes & Demo Bouquet Engine
 * Copyright © 2026 عبده رجب نصار — شركة ARN Technology
 */

const fs = require('fs');
const axios = require('axios');

const ATTR_REGEX = /([a-zA-Z0-9_-]+)\s*=\s*"([^"]*)"/g;
const SERIES_EP_REGEX = /^(.*?)\s*(?:[Ss](\d{1,2})\s*[Ee](\d{1,3})|(?:الموسم|موسم)\s*(\d{1,2})\s*(?:الحلقة|حلقة)\s*(\d{1,3})|(?:الحلقة|حلقة)\s*(\d{1,3}))\s*$/u;
const SERVER_SUFFIX_REGEX = /\s*(?:\[(?:سيرفر|server|srv|backup|احتياطي)\s*\d*[^\]]*\]|\((?:سيرفر|server|srv|backup|احتياطي)\s*\d*[^)]*\)|-\s*(?:backup|srv\s*\d+|احتياطي))\s*$/iu;

/**
 * Detects stream quality label from channel/movie title.
 * @param {string} title
 * @returns {string}
 */
function detectQualityBadge(title) {
  if (!title) return 'HD';
  if (/\b(4k|uhd|2160p)\b/i.test(title)) return '4K';
  if (/\b(fhd|1080p|full\s*hd)\b/i.test(title)) return 'FHD';
  if (/\b(hd|720p)\b/i.test(title)) return 'HD';
  if (/\b(sd|480p|360p|low)\b/i.test(title)) return 'SD';
  return 'HD';
}

/**
 * Classifies an item into 'live', 'movie', or 'series' based on group, title, and URL.
 */
function classifyContentType(groupTitle, title, url) {
  const g = (groupTitle || '').toLowerCase();
  const u = (url || '').toLowerCase();

  if (
    SERIES_EP_REGEX.test(title) ||
    u.includes('/series/') ||
    /(series|مسلسلات|مسلسل|حلقات)/i.test(g)
  ) {
    return 'series';
  }

  if (
    u.includes('/movie/') ||
    /\.(mp4|mkv|avi|mov)(\?|$)/i.test(u) ||
    /(vod|movies|افلام|أفلام|فيلم|سينما\s*حسب\s*الطلب)/i.test(g)
  ) {
    return 'movie';
  }

  return 'live';
}

/**
 * Parses an M3U / M3U8 text string at high speed (supports 50k–100k+ channels).
 * Automatically extracts VLC/Kodi headers, merges backup servers for duplicate
 * live channels, and groups series episodes under parent series entries.
 *
 * @param {string} m3uContent
 * @param {object} [options={}]
 * @returns {{ categories: Array, channels: Array }}
 */
function parseM3uContent(m3uContent, options = {}) {
  const mergeServers = options.mergeServers !== false;
  const text = String(m3uContent || '').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);

  const categoryMap = new Map(); // `${contentType}::${name}` -> categoryObj
  const liveDedupMap = new Map(); // `${catKey}::${baseName}` -> channelObj
  const seriesMap = new Map(); // `${catKey}::${seriesTitle}` -> seriesChannelObj
  const channels = [];

  let currentExtInf = null;
  let currentGroupOverride = '';
  let currentHeaders = {};
  let currentAgent = '';

  const ensureCategory = (name, contentType) => {
    const cleanName = (name || '').trim() || (contentType === 'movie' ? 'أفلام متنوعة' : contentType === 'series' ? 'مسلسلات متنوعة' : 'قنوات عامة');
    const key = `${contentType}::${cleanName}`;
    let cat = categoryMap.get(key);
    if (!cat) {
      cat = {
        externalId: key,
        name: cleanName,
        contentType,
        sortOrder: categoryMap.size
      };
      categoryMap.set(key, cat);
    }
    return cat;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const attrs = {};
      ATTR_REGEX.lastIndex = 0;
      let match;
      while ((match = ATTR_REGEX.exec(line)) !== null) {
        attrs[match[1].toLowerCase()] = match[2];
      }
      // Extract display name after the last comma outside quotes
      let lastQuote = -1;
      let inQuotes = false;
      let commaPos = -1;
      for (let c = 8; c < line.length; c++) {
        const ch = line[c];
        if (ch === '"') {
          inQuotes = !inQuotes;
          lastQuote = c;
        } else if (ch === ',' && !inQuotes && c > lastQuote) {
          commaPos = c;
          break;
        }
      }
      const rawTitle = commaPos !== -1 ? line.slice(commaPos + 1).trim() : (attrs['tvg-name'] || 'قناة بدون اسم');
      currentExtInf = {
        tvgId: attrs['tvg-id'] || '',
        tvgName: attrs['tvg-name'] || '',
        logo: attrs['tvg-logo'] || attrs.logo || '',
        group: attrs['group-title'] || attrs.group || '',
        title: rawTitle || attrs['tvg-name'] || 'قناة بدون اسم'
      };
      continue;
    }

    if (line.startsWith('#EXTGRP:')) {
      currentGroupOverride = line.slice(8).trim();
      continue;
    }

    if (line.startsWith('#EXTVLCOPT:')) {
      const opt = line.slice(11).trim();
      const eq = opt.indexOf('=');
      if (eq !== -1) {
        const k = opt.slice(0, eq).trim().toLowerCase();
        const v = opt.slice(eq + 1).trim();
        if (k === 'http-user-agent') currentAgent = v;
        else if (k === 'http-referrer' || k === 'http-referer') currentHeaders.Referer = v;
        else if (k === 'http-origin') currentHeaders.Origin = v;
      }
      continue;
    }

    if (line.startsWith('#KODIPROP:')) {
      const opt = line.slice(10).trim();
      if (opt.toLowerCase().startsWith('inputstream.adaptive.stream_headers=')) {
        const rawHdrs = opt.slice('inputstream.adaptive.stream_headers='.length);
        rawHdrs.split('&').forEach((pair) => {
          const eq = pair.indexOf('=');
          if (eq !== -1) {
            const hk = decodeURIComponent(pair.slice(0, eq).trim());
            const hv = decodeURIComponent(pair.slice(eq + 1).trim());
            if (hk.toLowerCase() === 'user-agent') currentAgent = hv;
            else if (hk) currentHeaders[hk] = hv;
          }
        });
      }
      continue;
    }

    if (line.startsWith('#')) {
      continue;
    }

    // Stream URL line
    const streamUrl = line;
    const info = currentExtInf || {
      tvgId: '',
      tvgName: '',
      logo: '',
      group: currentGroupOverride || 'قنوات عامة',
      title: `قناة ${channels.length + 1}`
    };

    const groupTitle = info.group || currentGroupOverride || 'قنوات عامة';
    const contentType = classifyContentType(groupTitle, info.title, streamUrl);
    const cat = ensureCategory(groupTitle, contentType);
    const itemHeaders = { ...currentHeaders };
    const itemAgent = currentAgent || '';

    if (contentType === 'series') {
      const epMatch = info.title.match(SERIES_EP_REGEX);
      const seriesTitle = epMatch ? epMatch[1].trim() || info.title : info.title;
      const seasonNum = epMatch ? Number(epMatch[2] || epMatch[4] || 1) : 1;
      const epNum = epMatch ? Number(epMatch[3] || epMatch[5] || epMatch[6] || 1) : 1;
      const seriesKey = `${cat.externalId}::${seriesTitle.toLowerCase()}`;

      let seriesItem = seriesMap.get(seriesKey);
      if (!seriesItem) {
        seriesItem = {
          externalId: info.tvgId || `ser_${seriesMap.size + 1}`,
          categoryExternalId: cat.externalId,
          groupTitle: cat.name,
          name: seriesTitle,
          contentType: 'series',
          logo: info.logo,
          streamUrl,
          servers: [{ name: `الموسم ${seasonNum} - الحلقة ${epNum}`, url: streamUrl, headers: itemHeaders, agent: itemAgent }],
          headers: itemHeaders,
          meta: {
            quality: detectQualityBadge(info.title),
            episodes: []
          },
          sortOrder: channels.length
        };
        seriesMap.set(seriesKey, seriesItem);
        channels.push(seriesItem);
      }
      seriesItem.meta.episodes.push({
        season: seasonNum,
        episode: epNum,
        title: `الموسم ${seasonNum} • الحلقة ${epNum}`,
        url: streamUrl,
        headers: itemHeaders,
        agent: itemAgent
      });
    } else if (contentType === 'live' && mergeServers) {
      const baseTitle = info.title.replace(SERVER_SUFFIX_REGEX, '').trim() || info.title;
      const dedupKey = `${cat.externalId}::${baseTitle.toLowerCase()}`;
      const existing = liveDedupMap.get(dedupKey);

      if (existing && existing.servers.length < 8) {
        const srvIdx = existing.servers.length + 1;
        existing.servers.push({
          name: `سيرفر ${srvIdx} (احتياطي)`,
          url: streamUrl,
          headers: itemHeaders,
          agent: itemAgent
        });
        if (!existing.logo && info.logo) existing.logo = info.logo;
      } else {
        const chObj = {
          externalId: info.tvgId || `ch_${channels.length + 1}`,
          categoryExternalId: cat.externalId,
          groupTitle: cat.name,
          name: baseTitle,
          contentType: 'live',
          logo: info.logo,
          streamUrl,
          servers: [
            {
              name: 'سيرفر 1 (الرئيسي)',
              url: streamUrl,
              headers: itemHeaders,
              agent: itemAgent
            }
          ],
          headers: itemHeaders,
          meta: {
            quality: detectQualityBadge(info.title),
            tvgId: info.tvgId
          },
          sortOrder: channels.length
        };
        liveDedupMap.set(dedupKey, chObj);
        channels.push(chObj);
      }
    } else {
      channels.push({
        externalId: info.tvgId || `item_${channels.length + 1}`,
        categoryExternalId: cat.externalId,
        groupTitle: cat.name,
        name: info.title,
        contentType,
        logo: info.logo,
        streamUrl,
        servers: [
          {
            name: 'سيرفر 1 (الرئيسي)',
            url: streamUrl,
            headers: itemHeaders,
            agent: itemAgent
          }
        ],
        headers: itemHeaders,
        meta: {
          quality: detectQualityBadge(info.title),
          tvgId: info.tvgId
        },
        sortOrder: channels.length
      });
    }

    currentExtInf = null;
    currentGroupOverride = '';
    currentHeaders = {};
    currentAgent = '';
  }

  return {
    categories: Array.from(categoryMap.values()),
    channels
  };
}

/**
 * Fetches and parses a remote M3U/M3U8 playlist URL.
 */
async function importM3uUrl(url, options = {}, onProgress = () => {}) {
  const cleanUrl = String(url || '').trim();
  if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
    throw new Error('يرجى إدخال رابط M3U صحيح يبدأ بـ http:// أو https://');
  }

  onProgress({ percent: 15, message: 'جاري الاتصال بخادم القائمة وتحميل ملف M3U...' });

  const resp = await axios.get(cleanUrl, {
    responseType: 'text',
    timeout: options.timeout || 25000,
    headers: {
      'User-Agent': options.userAgent || 'VLC/3.0.20 LibVLC/3.0.20'
    },
    onDownloadProgress: (evt) => {
      if (evt.total) {
        const pct = 15 + Math.round((evt.loaded / evt.total) * 55);
        onProgress({ percent: Math.min(70, pct), message: 'جاري تنزيل بيانات القنوات...' });
      }
    }
  });

  onProgress({ percent: 75, message: 'جاري تحليل القنوات وتجميع السيرفرات المتعددة...' });
  const parsed = parseM3uContent(resp.data, options);

  if (parsed.channels.length === 0) {
    throw new Error('لم يتم العثور على أي قنوات صالحة داخل هذا الرابط');
  }

  onProgress({ percent: 100, message: `تم تحليل ${parsed.channels.length} عنصر بنجاح` });
  return parsed;
}

/**
 * Reads and parses a local M3U/M3U8 file from disk.
 */
function importM3uFile(filePath, options = {}, onProgress = () => {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('الملف المحدد غير موجود');
  }
  onProgress({ percent: 25, message: 'جاري قراءة ملف القائمة المحلي...' });
  const raw = fs.readFileSync(filePath, 'utf8');
  onProgress({ percent: 65, message: 'جاري فرز التصنيفات والقنوات...' });
  const parsed = parseM3uContent(raw, options);
  if (parsed.channels.length === 0) {
    throw new Error('الملف لا يحتوي على قنوات M3U صالحة');
  }
  onProgress({ percent: 100, message: `تم استيراد ${parsed.channels.length} قناة بنجاح` });
  return parsed;
}

/**
 * Imports Live TV, Movies (VOD), and Series from an Xtream Codes API server.
 */
async function importXtreamAccount({ host, username, password }, onProgress = () => {}) {
  const baseHost = String(host || '').trim().replace(/\/+$/, '');
  const user = String(username || '').trim();
  const pass = String(password || '').trim();

  if (!baseHost || !/^https?:\/\//i.test(baseHost) || !user || !pass) {
    throw new Error('يرجى إدخال عنوان الخادم واسم المستخدم وكلمة المرور بشكل صحيح');
  }

  const apiBase = `${baseHost}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
  const reqCfg = { timeout: 18000, headers: { 'User-Agent': 'ARN-IPTV-Pro/2.0' } };

  onProgress({ percent: 10, message: 'جاري التحقق من بيانات حساب Xtream Codes...' });
  const authResp = await axios.get(apiBase, reqCfg);
  if (!authResp.data || authResp.data.user_info?.auth === 0) {
    throw new Error('بيانات الدخول غير صحيحة أو الحساب منتهي الصلاحية');
  }

  const categories = [];
  const channels = [];

  // 1. Live Categories & Streams
  onProgress({ percent: 25, message: 'جاري جلب تصنيفات وقنوات البث المباشر...' });
  const [liveCatsResp, liveStreamsResp] = await Promise.all([
    axios.get(`${apiBase}&action=get_live_categories`, reqCfg).catch(() => ({ data: [] })),
    axios.get(`${apiBase}&action=get_live_streams`, reqCfg).catch(() => ({ data: [] }))
  ]);

  const liveCatNameById = new Map();
  if (Array.isArray(liveCatsResp.data)) {
    liveCatsResp.data.forEach((c, idx) => {
      const extId = `live_${c.category_id}`;
      const name = String(c.category_name || `تصنيف ${idx + 1}`).trim();
      liveCatNameById.set(String(c.category_id), { extId, name });
      categories.push({ externalId: extId, name, contentType: 'live', sortOrder: categories.length });
    });
  }

  if (Array.isArray(liveStreamsResp.data)) {
    liveStreamsResp.data.forEach((s, idx) => {
      const catRef = liveCatNameById.get(String(s.category_id)) || { extId: 'live_general', name: 'قنوات عامة' };
      if (!liveCatNameById.has(String(s.category_id)) && !categories.some((c) => c.externalId === 'live_general')) {
        categories.push({ externalId: 'live_general', name: 'قنوات عامة', contentType: 'live', sortOrder: categories.length });
      }
      const hlsUrl = `${baseHost}/live/${encodeURIComponent(user)}/${encodeURIComponent(pass)}/${s.stream_id}.m3u8`;
      const tsUrl = `${baseHost}/live/${encodeURIComponent(user)}/${encodeURIComponent(pass)}/${s.stream_id}.ts`;
      channels.push({
        externalId: String(s.stream_id),
        categoryExternalId: catRef.extId,
        groupTitle: catRef.name,
        name: String(s.name || `قناة ${idx + 1}`).trim(),
        contentType: 'live',
        logo: String(s.stream_icon || ''),
        streamUrl: hlsUrl,
        servers: [
          { name: 'سيرفر 1 (HLS الرئيسي)', url: hlsUrl },
          { name: 'سيرفر 2 (MPEG-TS احتياطي)', url: tsUrl }
        ],
        meta: { quality: detectQualityBadge(s.name), epgId: s.epg_channel_id || '' },
        sortOrder: idx
      });
    });
  }

  // 2. VOD Movies
  onProgress({ percent: 60, message: 'جاري جلب مكتبة الأفلام (VOD)...' });
  const [vodCatsResp, vodStreamsResp] = await Promise.all([
    axios.get(`${apiBase}&action=get_vod_categories`, reqCfg).catch(() => ({ data: [] })),
    axios.get(`${apiBase}&action=get_vod_streams`, reqCfg).catch(() => ({ data: [] }))
  ]);

  const vodCatNameById = new Map();
  if (Array.isArray(vodCatsResp.data)) {
    vodCatsResp.data.forEach((c, idx) => {
      const extId = `vod_${c.category_id}`;
      const name = String(c.category_name || `أفلام ${idx + 1}`).trim();
      vodCatNameById.set(String(c.category_id), { extId, name });
      categories.push({ externalId: extId, name, contentType: 'movie', sortOrder: categories.length });
    });
  }

  if (Array.isArray(vodStreamsResp.data)) {
    vodStreamsResp.data.forEach((m, idx) => {
      const catRef = vodCatNameById.get(String(m.category_id)) || { extId: 'vod_general', name: 'أفلام متنوعة' };
      if (!vodCatNameById.has(String(m.category_id)) && !categories.some((c) => c.externalId === 'vod_general')) {
        categories.push({ externalId: 'vod_general', name: 'أفلام متنوعة', contentType: 'movie', sortOrder: categories.length });
      }
      const ext = m.container_extension || 'mp4';
      const vodUrl = `${baseHost}/movie/${encodeURIComponent(user)}/${encodeURIComponent(pass)}/${m.stream_id}.${ext}`;
      channels.push({
        externalId: `vod_${m.stream_id}`,
        categoryExternalId: catRef.extId,
        groupTitle: catRef.name,
        name: String(m.name || `فيلم ${idx + 1}`).trim(),
        contentType: 'movie',
        logo: String(m.stream_icon || ''),
        streamUrl: vodUrl,
        servers: [{ name: 'سيرفر VOD الرئيسي', url: vodUrl }],
        meta: {
          quality: detectQualityBadge(m.name),
          rating: m.rating || ''
        },
        sortOrder: idx
      });
    });
  }

  // 3. Series
  onProgress({ percent: 85, message: 'جاري جلب فهرس المسلسلات...' });
  const [serCatsResp, serListResp] = await Promise.all([
    axios.get(`${apiBase}&action=get_series_categories`, reqCfg).catch(() => ({ data: [] })),
    axios.get(`${apiBase}&action=get_series`, reqCfg).catch(() => ({ data: [] }))
  ]);

  const serCatNameById = new Map();
  if (Array.isArray(serCatsResp.data)) {
    serCatsResp.data.forEach((c, idx) => {
      const extId = `ser_${c.category_id}`;
      const name = String(c.category_name || `مسلسلات ${idx + 1}`).trim();
      serCatNameById.set(String(c.category_id), { extId, name });
      categories.push({ externalId: extId, name, contentType: 'series', sortOrder: categories.length });
    });
  }

  if (Array.isArray(serListResp.data)) {
    serListResp.data.forEach((s, idx) => {
      const catRef = serCatNameById.get(String(s.category_id)) || { extId: 'ser_general', name: 'مسلسلات متنوعة' };
      if (!serCatNameById.has(String(s.category_id)) && !categories.some((c) => c.externalId === 'ser_general')) {
        categories.push({ externalId: 'ser_general', name: 'مسلسلات متنوعة', contentType: 'series', sortOrder: categories.length });
      }
      channels.push({
        externalId: `xtream_ser_${s.series_id}`,
        categoryExternalId: catRef.extId,
        groupTitle: catRef.name,
        name: String(s.name || `مسلسل ${idx + 1}`).trim(),
        contentType: 'series',
        logo: String(s.cover || ''),
        streamUrl: `xtream-series://${s.series_id}`,
        servers: [{ name: 'سيرفر المسلسلات الرئيسي', url: `xtream-series://${s.series_id}` }],
        meta: {
          quality: 'FHD',
          rating: s.rating || '',
          plot: s.plot || '',
          xtreamSeriesId: s.series_id
        },
        sortOrder: idx
      });
    });
  }

  onProgress({ percent: 100, message: `اكتمل استيراد ${channels.length} عنصر من Xtream Codes` });
  return { categories, channels };
}

/**
 * Generates the built-in ARN Technology Showcase Bouquet with playable local
 * multi-bitrate HLS streams (1080p/720p/480p/360p), Multi-Server Auto-Failover demo,
 * FG Drama Live AES-128-CBC + k9x_ Swap live demo, VOD Movies, and Series!
 */
function buildDefaultDemoBouquet() {
  const categories = [
    // Live Categories
    { externalId: 'demo_sports', name: '⚽ القنوات الرياضية المشفرة', contentType: 'live', sortOrder: 1 },
    { externalId: 'demo_news', name: '🌍 القنوات الإخبارية المباشرة', contentType: 'live', sortOrder: 2 },
    { externalId: 'demo_entertainment', name: '🎭 قنوات السينما والترفيه', contentType: 'live', sortOrder: 3 },
    { externalId: 'demo_islamic', name: '🕌 القرآن الكريم والقنوات الدينية', contentType: 'live', sortOrder: 4 },
    { externalId: 'demo_kids', name: '🧸 قنوات الأطفال والأسرة', contentType: 'live', sortOrder: 5 },
    { externalId: 'demo_doc', name: '🔭 القنوات الوثائقية والعلمية', contentType: 'live', sortOrder: 6 },
    // Movie Categories
    { externalId: 'demo_mov_ar', name: '🔥 أفلام عربية حصرية', contentType: 'movie', sortOrder: 10 },
    { externalId: 'demo_mov_global', name: '🎥 أفلام عالمية 4K UHD', contentType: 'movie', sortOrder: 11 },
    { externalId: 'demo_mov_doc', name: '🌌 أفلام وثائقية مختارة', contentType: 'movie', sortOrder: 12 },
    // Series Categories
    { externalId: 'demo_ser_ar', name: '📺 مسلسلات الدراما العربية', contentType: 'series', sortOrder: 20 },
    { externalId: 'demo_ser_global', name: '🌐 مسلسلات عالمية مترجمة', contentType: 'series', sortOrder: 21 }
  ];

  const liveSpecs = [
    {
      id: 'arn_sp_1',
      cat: 'demo_sports',
      group: '⚽ القنوات الرياضية المشفرة',
      name: 'ARN Sports 1 Premium 4K',
      quality: '4K',
      fav: 1,
      epg: 'بث مباشر: الاستوديو التحليلي لدوري أبطال أوروبا • تقنية Adaptive HLS',
      servers: [
        { name: 'سيرفر 1 (الرئيسي - 4K Adaptive)', url: 'demo://live/arn_sp_1?srv=1' },
        { name: 'سيرفر 2 (احتياطي سريع - FHD)', url: 'demo://live/arn_sp_1?srv=2' },
        { name: 'سيرفر 3 (طوارئ منخفض الاستهلاك)', url: 'demo://live/arn_sp_1?srv=3' }
      ]
    },
    {
      id: 'arn_fg_101',
      cat: 'demo_sports',
      group: '⚽ القنوات الرياضية المشفرة',
      name: 'Drama Live FG Engine HD (فك تشفير AES + k9x_)',
      quality: 'FHD',
      fav: 1,
      epg: 'اختبار حي لمحرك fg_engine.js وإزالة تشويش مقاطع k9x_ عبر البروكسي',
      servers: [
        { name: 'سيرفر 1 (محرك FG المشفر)', url: 'fg://arn_fg_101?code=ARN2026&srv=0' },
        { name: 'سيرفر 2 (احتياطي FG)', url: 'fg://arn_fg_101?code=ARN2026&srv=1' }
      ]
    },
    {
      id: 'arn_failover_test',
      cat: 'demo_sports',
      group: '⚽ القنوات الرياضية المشفرة',
      name: 'ARN Sports Max (اختبار التحويل التلقائي Auto-Failover)',
      quality: 'FHD',
      fav: 1,
      epg: 'يحاكي توقف السيرفر 1 للتحقق من الانتقال التلقائي الفوري للسيرفر 2 الاحتياطي',
      servers: [
        { name: 'سيرفر 1 (محاكاة انقطاع الخادم)', url: 'demo://fail/server1_down' },
        { name: 'سيرفر 2 (احتياطي يعمل بكفاءة 100%)', url: 'demo://live/arn_failover_ok?srv=2' },
        { name: 'سيرفر 3 (احتياطي إضافي)', url: 'demo://live/arn_failover_ok?srv=3' }
      ]
    },
    {
      id: 'arn_sp_2',
      cat: 'demo_sports',
      group: '⚽ القنوات الرياضية المشفرة',
      name: 'ARN Sports 2 FHD',
      quality: 'FHD',
      fav: 0,
      epg: 'تغطية الدوريات الأوروبية والعربية بجودة متعددة المستويات',
      servers: [
        { name: 'سيرفر 1 (الرئيسي)', url: 'demo://live/arn_sp_2?srv=1' },
        { name: 'سيرفر 2 (احتياطي)', url: 'demo://live/arn_sp_2?srv=2' }
      ]
    },
    {
      id: 'arn_sp_3',
      cat: 'demo_sports',
      group: '⚽ القنوات الرياضية المشفرة',
      name: 'ARN Arena Fight & Motorsport HD',
      quality: 'HD',
      fav: 0,
      epg: 'سباقات السرعة والفنون القتالية المباشرة'
    },
    {
      id: 'arn_news_1',
      cat: 'demo_news',
      group: '🌍 القنوات الإخبارية المباشرة',
      name: 'ARN الإخبارية مباشر FHD',
      quality: 'FHD',
      fav: 1,
      epg: 'نشرة الأخبار العالمية والتغطية الميدانية على مدار الساعة'
    },
    {
      id: 'arn_news_2',
      cat: 'demo_news',
      group: '🌍 القنوات الإخبارية المباشرة',
      name: 'القاهرة الإخبارية HD (بث تجريبي)',
      quality: 'FHD',
      fav: 0,
      epg: 'تغطية إخبارية إقليمية ودولية شاملة'
    },
    {
      id: 'arn_news_3',
      cat: 'demo_news',
      group: '🌍 القنوات الإخبارية المباشرة',
      name: 'ARN اقتصاد وأسواق المال HD',
      quality: 'HD',
      fav: 0,
      epg: 'مؤشرات البورصات العالمية وأسعار الطاقة والتقنية'
    },
    {
      id: 'arn_ent_1',
      cat: 'demo_entertainment',
      group: '🎭 قنوات السينما والترفيه',
      name: 'ARN Cinema Premiere 4K',
      quality: '4K',
      fav: 1,
      epg: 'روائع السينما العربية والعالمية بدون فواصل'
    },
    {
      id: 'arn_ent_2',
      cat: 'demo_entertainment',
      group: '🎭 قنوات السينما والترفيه',
      name: 'ARN زمان كلاسيك HD',
      quality: 'HD',
      fav: 0,
      epg: 'روائع الزمن الجميل والمسرحيات الكلاسيكية'
    },
    {
      id: 'arn_ent_3',
      cat: 'demo_entertainment',
      group: '🎭 قنوات السينما والترفيه',
      name: 'ARN دراما مصرية والخليج FHD',
      quality: 'FHD',
      fav: 0,
      epg: 'أقوى المسلسلات الاجتماعية والتاريخية على مدار اليوم'
    },
    {
      id: 'arn_isl_1',
      cat: 'demo_islamic',
      group: '🕌 القرآن الكريم والقنوات الدينية',
      name: 'قناة القرآن الكريم — بث مباشر FHD',
      quality: 'FHD',
      fav: 1,
      epg: 'تلاوات خاشعة بأصوات كبار القراء على مدار 24 ساعة'
    },
    {
      id: 'arn_isl_2',
      cat: 'demo_islamic',
      group: '🕌 القرآن الكريم والقنوات الدينية',
      name: 'قناة السنة النبوية الشريفة HD',
      quality: 'HD',
      fav: 0,
      epg: 'بث روحاني وحديث نبوي شريف بجودة عالية'
    },
    {
      id: 'arn_kids_1',
      cat: 'demo_kids',
      group: '🧸 قنوات الأطفال والأسرة',
      name: 'ARN Kids كرتون ومغامرات FHD',
      quality: 'FHD',
      fav: 0,
      epg: 'برامج تعليمية وترفيهية آمنة للأطفال باللغة العربية'
    },
    {
      id: 'arn_doc_1',
      cat: 'demo_doc',
      group: '🔭 القنوات الوثائقية والعلمية',
      name: 'ARN Discovery علوم وطبيعة 4K',
      quality: '4K',
      fav: 0,
      epg: 'استكشاف أعماق المحيطات وتقنيات الذكاء الاصطناعي والفضاء'
    }
  ];

  const movieSpecs = [
    {
      id: 'mov_1',
      cat: 'demo_mov_ar',
      group: '🔥 أفلام عربية حصرية',
      name: 'ليلة في القاهرة — النسخة الكاملة FHD',
      quality: 'FHD',
      year: '2026',
      rating: '8.7',
      duration: '02:14:00',
      plot: 'رحلة درامية مشوّقة في قلب القاهرة تجمع بين الغموض والتكنولوجيا الحديثة في إطار سينمائي مبهر.'
    },
    {
      id: 'mov_2',
      cat: 'demo_mov_ar',
      group: '🔥 أفلام عربية حصرية',
      name: 'فرسان الصحراء — مغامرات تاريخية 4K',
      quality: '4K',
      year: '2025',
      rating: '8.4',
      duration: '02:05:00',
      plot: 'ملحمة تاريخية مصورة بدقة فائقة تروي بطولة الفرسان عبر طرق التجارة القديمة.'
    },
    {
      id: 'mov_3',
      cat: 'demo_mov_global',
      group: '🎥 أفلام عالمية 4K UHD',
      name: 'Quantum Horizon — أفق الكوانتم (مترجم)',
      quality: '4K',
      year: '2026',
      rating: '9.1',
      duration: '02:28:00',
      plot: 'فريق من العلماء يبتكر شبكة اتصالات كمومية تغير مستقبل البشرية في الفضاء العميق.'
    },
    {
      id: 'mov_4',
      cat: 'demo_mov_doc',
      group: '🌌 أفلام وثائقية مختارة',
      name: 'أسرار المجرات البعيدة — تلسكوب المستقبل',
      quality: '4K',
      year: '2026',
      rating: '9.3',
      duration: '01:32:00',
      plot: 'وثائقي علمي مذهل يستعرض أحدث الصور الكونية وتشكّل النجوم العملاقة.'
    }
  ];

  const seriesSpecs = [
    {
      id: 'ser_1',
      cat: 'demo_ser_ar',
      group: '📺 مسلسلات الدراما العربية',
      name: 'شفرة النيل — الموسم الأول',
      quality: 'FHD',
      year: '2026',
      rating: '8.9',
      plot: 'مهندس أمن سيبراني يكتشف مخططاً رقمياً غامضاً ويخوض سباقاً مع الزمن عبر 5 حلقات مشوقة.',
      episodesCount: 5
    },
    {
      id: 'ser_2',
      cat: 'demo_ser_global',
      group: '🌐 مسلسلات عالمية مترجمة',
      name: 'Cyber Fortress — القلعة الرقمية (مترجم)',
      quality: '4K',
      year: '2026',
      rating: '9.0',
      plot: 'سلسلة إثارة تقنية حول حماية البنية التحتية العالمية من الهجمات المتقدمة.',
      episodesCount: 4
    }
  ];

  const channels = [];

  liveSpecs.forEach((item, idx) => {
    const servers = item.servers || [
      { name: 'سيرفر 1 (الرئيسي - Adaptive HLS)', url: `demo://live/${item.id}?srv=1` },
      { name: 'سيرفر 2 (احتياطي مستقر)', url: `demo://live/${item.id}?srv=2` }
    ];
    channels.push({
      externalId: item.id,
      categoryExternalId: item.cat,
      groupTitle: item.group,
      name: item.name,
      contentType: 'live',
      logo: '',
      streamUrl: servers[0].url,
      servers,
      isFavorite: item.fav ? 1 : 0,
      meta: {
        quality: item.quality,
        epgNow: item.epg
      },
      sortOrder: idx
    });
  });

  movieSpecs.forEach((mov, idx) => {
    const servers = [
      { name: 'سيرفر VOD 1 (Multi-Quality HLS)', url: `demo://vod/${mov.id}?srv=1` },
      { name: 'سيرفر VOD 2 (احتياطي مباشر)', url: `demo://vod/${mov.id}?srv=2` }
    ];
    channels.push({
      externalId: mov.id,
      categoryExternalId: mov.cat,
      groupTitle: mov.group,
      name: mov.name,
      contentType: 'movie',
      logo: '',
      streamUrl: servers[0].url,
      servers,
      isFavorite: idx === 0 ? 1 : 0,
      meta: {
        quality: mov.quality,
        year: mov.year,
        rating: mov.rating,
        duration: mov.duration,
        plot: mov.plot
      },
      sortOrder: 100 + idx
    });
  });

  seriesSpecs.forEach((ser, idx) => {
    const episodes = [];
    for (let e = 1; e <= ser.episodesCount; e++) {
      episodes.push({
        season: 1,
        episode: e,
        title: `الموسم 1 • الحلقة ${e}`,
        url: `demo://vod/${ser.id}_s1e${e}?srv=1`
      });
    }
    channels.push({
      externalId: ser.id,
      categoryExternalId: ser.cat,
      groupTitle: ser.group,
      name: ser.name,
      contentType: 'series',
      logo: '',
      streamUrl: episodes[0].url,
      servers: episodes.map((ep) => ({ name: ep.title, url: ep.url })),
      isFavorite: idx === 0 ? 1 : 0,
      meta: {
        quality: ser.quality,
        year: ser.year,
        rating: ser.rating,
        plot: ser.plot,
        episodes
      },
      sortOrder: 200 + idx
    });
  });

  return {
    playlistName: 'باقة ARN IPTV الرسمية (عرض تفاعلي مدمج)',
    categories,
    channels
  };
}

/**
 * Generates a 50,000+ channel playlist in-memory to benchmark SQLite & Virtual Scroll performance.
 */
function buildBenchmark50kBouquet(totalChannels = 50000) {
  const catNames = [
    '⚽ قنوات الرياضة العالمية',
    '🇪🇬 القنوات المصرية والعربية',
    '🇸🇦 القنوات الخليجية والسعودية',
    '🇲🇦 قنوات المغرب العربي',
    '🌍 القنوات الإخبارية الدولية',
    '🎬 قنوات الأفلام والسينما',
    '🎭 قنوات الدراما والمسلسلات',
    '🔭 القنوات الوثائقية والعلمية',
    '🧸 قنوات الأطفال والأنمي',
    '🇫🇷 القنوات الأوروبية والفرنسية'
  ];

  const categories = catNames.map((name, idx) => ({
    externalId: `bench_cat_${idx}`,
    name,
    contentType: 'live',
    sortOrder: idx
  }));

  const qualities = ['4K', 'FHD', 'HD', 'SD'];
  const channels = new Array(totalChannels);

  for (let i = 0; i < totalChannels; i++) {
    const catIdx = i % categories.length;
    const cat = categories[catIdx];
    const q = qualities[i % qualities.length];
    const chNum = i + 1;
    const url1 = `demo://live/bench_${chNum}?srv=1`;
    const url2 = `demo://live/bench_${chNum}?srv=2`;

    channels[i] = {
      externalId: `bench_${chNum}`,
      categoryExternalId: cat.externalId,
      groupTitle: cat.name,
      name: `قناة ARN الرقمية #${chNum} ${q}`,
      contentType: 'live',
      logo: '',
      streamUrl: url1,
      servers: [
        { name: 'سيرفر 1 (الرئيسي)', url: url1 },
        { name: 'سيرفر 2 (احتياطي)', url: url2 }
      ],
      meta: { quality: q, epgNow: `بث رقمي عالي الاستقرار — قناة رقم ${chNum}` },
      sortOrder: i
    };
  }

  return {
    playlistName: `قائمة اختبار الأداء الفائق (${totalChannels.toLocaleString('en-US')} قناة)`,
    categories,
    channels
  };
}

module.exports = {
  detectQualityBadge,
  classifyContentType,
  parseM3uContent,
  importM3uUrl,
  importM3uFile,
  importXtreamAccount,
  buildDefaultDemoBouquet,
  buildBenchmark50kBouquet
};
