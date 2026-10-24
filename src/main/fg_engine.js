'use strict';

/**
 * ARN IPTV Pro — Drama Live (FG) Encryption & Stream Resolution Engine
 * Copyright © 2026 عبده رجب نصار — شركة ARN Technology
 *
 * Implements AES-128-CBC (PKCS7) payload encryption/decryption,
 * v187 / v13.0.0 protocol payloads, multi-server stream resolution,
 * and full category/channel bouquet synchronization.
 */

const crypto = require('crypto');
const axios = require('axios');

const DRAMA_KEY = Buffer.from('0123456789abcdef', 'utf8');
const DRAMA_IV = Buffer.from('fedcba9876543210', 'utf8');

const DEFAULT_MAIN_SERVER = 'http://main.eastgoessouth.online/api/live/livedrama/v13.0.0/';
const DEFAULT_LIVE_SERVER = 'http://live.eastgoessouth.online/api/live/livedrama/v13.0.0/';
const DEFAULT_REDIRECT_SERVER = 'http://redirect.eastgoessouth.online/redirect/';
const DEFAULT_USER_AGENT = 'Dalvik/2.1.0 (Linux; U; Android 14; Build/UP1A.231005.007)';

/**
 * Encrypts a JS object using AES-128-CBC with PKCS7 padding in Drama Live format.
 * Output format: "<base64_ciphertext>:<base64_iv>"
 * @param {object} dataObj
 * @param {Buffer} [customIv]
 * @returns {string}
 */
function encryptPayload(dataObj, customIv = DRAMA_IV) {
  const plain = typeof dataObj === 'string' ? dataObj : JSON.stringify(dataObj);
  const iv = Buffer.isBuffer(customIv) && customIv.length === 16 ? customIv : DRAMA_IV;
  const cipher = crypto.createCipheriv('aes-128-cbc', DRAMA_KEY, iv);
  let encrypted = cipher.update(plain, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const ivB64 = iv.toString('base64');
  return `${encrypted}:${ivB64}`;
}

/**
 * Decrypts a "<base64_ciphertext>:<base64_iv>" string from Drama Live API.
 * Gracefully handles pre-parsed objects, surrounding quotes, or plain JSON strings.
 * @param {string|object} encInput
 * @returns {string}
 */
function decryptPayload(encInput) {
  if (encInput === null || encInput === undefined) return '';
  if (typeof encInput === 'object') {
    return JSON.stringify(encInput);
  }

  const raw = String(encInput).trim();
  if (!raw) return '';

  // Already plain JSON object or array
  if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
    return raw;
  }

  const clean = raw.replace(/^"+|"+$/g, '').trim();
  const sepIdx = clean.indexOf(':');
  if (sepIdx === -1) return raw;

  const ctB64 = clean.slice(0, sepIdx).trim();
  const ivB64 = clean.slice(sepIdx + 1).trim();
  if (!ctB64 || !ivB64) return raw;

  try {
    const ct = Buffer.from(ctB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    if (iv.length !== 16 || ct.length === 0 || ct.length % 16 !== 0) {
      return raw;
    }
    const decipher = crypto.createDecipheriv('aes-128-cbc', DRAMA_KEY, iv);
    let decrypted = decipher.update(ct, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    // Strip any trailing null padding bytes if present
    return decrypted.replace(/\0+$/g, '').trim();
  } catch (_err) {
    return raw;
  }
}

/**
 * Safely decrypts and parses JSON from an encrypted Drama Live API response.
 * @param {string|object} encInput
 * @returns {object}
 */
function decryptAndParseJson(encInput) {
  const dec = decryptPayload(encInput);
  if (!dec) return {};
  try {
    return JSON.parse(dec);
  } catch (err) {
    throw new Error(`فشل تحليل استجابة الخادم المشفرة: ${err.message}`);
  }
}

/**
 * Builds standard Drama Live v187 / v13.0.0 request payload.
 * @param {string|number} code
 * @param {string|number|null} [topicId=null]
 * @param {object} [extra={}]
 * @returns {object}
 */
function buildDramaPayload(code, topicId = null, extra = {}) {
  const payload = {
    user_id: 'arn_iptv_user',
    device_id: 'arn_iptv_dev_9921',
    device_api: '34',
    version_name: '187',
    language: 'ar',
    timezone: 'Africa/Cairo',
    device_type: 'phone',
    KEY_ACTIVATED_TYPE: String(code || '202122').trim(),
    store: 'direct',
    type: 'tv',
    isStoreVersion: false,
    isPremium: false,
    isCoupon_active: false,
    hideAds: false,
    appCount: '1',
    mainServer: DEFAULT_MAIN_SERVER,
    ...extra
  };
  if (topicId !== null && topicId !== undefined && topicId !== '') {
    payload.topic = String(topicId);
  }
  return payload;
}

/**
 * Parses raw redirect URL field which may be a plain URL or JSON descriptor
 * containing `{ url, headers, agent, swap, backups }`.
 * @param {string|object} rawUrl
 * @param {string} [fallbackAgent]
 * @returns {{ streamUrl: string, headers: Record<string, string>, agent: string, swap: Record<string, string>, backups: string[] }}
 */
function parseRedirectDescriptor(rawUrl, fallbackAgent = '') {
  if (!rawUrl) {
    return { streamUrl: '', headers: {}, agent: fallbackAgent || '', swap: {}, backups: [] };
  }

  if (typeof rawUrl === 'object') {
    return {
      streamUrl: String(rawUrl.url || rawUrl.streamUrl || ''),
      headers: rawUrl.headers && typeof rawUrl.headers === 'object' ? rawUrl.headers : {},
      agent: String(rawUrl.agent || fallbackAgent || ''),
      swap: rawUrl.swap && typeof rawUrl.swap === 'object' ? rawUrl.swap : {},
      backups: Array.isArray(rawUrl.backups) ? rawUrl.backups : []
    };
  }

  const trimmed = String(rawUrl).trim();
  if (trimmed.startsWith('{')) {
    try {
      const adv = JSON.parse(trimmed);
      return {
        streamUrl: String(adv.url || adv.stream || ''),
        headers: adv.headers && typeof adv.headers === 'object' ? adv.headers : {},
        agent: String(adv.agent || fallbackAgent || ''),
        swap: adv.swap && typeof adv.swap === 'object' ? adv.swap : {},
        backups: Array.isArray(adv.backups) ? adv.backups : []
      };
    } catch (_e) {
      // Fall through to plain URL
    }
  }

  return {
    streamUrl: trimmed,
    headers: {},
    agent: fallbackAgent || '',
    swap: {},
    backups: []
  };
}

/**
 * Checks whether a code refers to the built-in ARN FG encrypted test simulator.
 * @param {string|number} code
 * @returns {boolean}
 */
function isSimulatedFgCode(code) {
  const norm = String(code || '').trim().toUpperCase();
  return norm === 'ARN2026' || norm === '000000' || norm === 'ARN-DEMO';
}

/**
 * Resolves a Drama Live channel ID (`idLive`) into its real upstream HLS URL,
 * custom headers, User-Agent, and `k9x_` segment swap rules.
 *
 * @param {string|number} code - FG Activation code (e.g. "202122")
 * @param {string|number} idLive - Channel ID
 * @param {number} [serverIndex=0] - Server index (0 = primary, 1+ = backup)
 * @param {object} [options={}] - Optional overrides (`proxyPort`, `liveServer`, `redirectServer`, `timeout`)
 */
async function resolveFgStream(code, idLive, serverIndex = 0, options = {}) {
  const cleanId = String(idLive).trim();
  const cleanCode = String(code || '202122').trim();
  const proxyPort = options.proxyPort || 39871;

  // Built-in local loopback FG test stream exercising AES-128-CBC + k9x_ swap!
  if (isSimulatedFgCode(cleanCode) || cleanId.startsWith('arn_fg_')) {
    const simulatedEncryptedResponse = encryptPayload({
      url: `http://127.0.0.1:${proxyPort}/__fg_upstream/${encodeURIComponent(cleanId)}/master.m3u8`,
      headers: { 'X-ARN-FG-Engine': 'AES-128-CBC-Verified' },
      agent: DEFAULT_USER_AGENT,
      swap: { k9x_: '' }
    });
    const decoded = decryptAndParseJson(simulatedEncryptedResponse);
    return parseRedirectDescriptor(decoded, DEFAULT_USER_AGENT);
  }

  const liveServer = options.liveServer || DEFAULT_LIVE_SERVER;
  const redirectServer = options.redirectServer || DEFAULT_REDIRECT_SERVER;
  const timeout = options.timeout || 9000;

  const headers = {
    'User-Agent': DEFAULT_USER_AGENT,
    'Content-Type': 'application/json; charset=utf-8',
    Accept: 'application/json, text/plain, */*'
  };

  const basePayload = buildDramaPayload(cleanCode);

  // Step 1: getLiveById
  const pId = { ...basePayload, id: [isNaN(Number(cleanId)) ? cleanId : Number(cleanId)] };
  const rId = await axios.post(
    `${liveServer}getLiveById`,
    JSON.stringify(encryptPayload(pId)),
    { headers, timeout, transformResponse: [(d) => d] }
  );

  const decId = decryptAndParseJson(rId.data);
  const candidates = Array.isArray(decId.live)
    ? decId.live
    : Array.isArray(decId.data)
      ? decId.data
      : [];

  if (candidates.length === 0) {
    throw new Error(`لم يتم العثور على بيانات البث للقناة (${cleanId})`);
  }

  const chosen = candidates[Math.min(serverIndex, candidates.length - 1)] || candidates[0];
  let candidateUrl = chosen.url || '';
  if (serverIndex > 0 && candidates.length === 1) {
    const altList = []
      .concat(chosen.url2 || [])
      .concat(chosen.url3 || [])
      .concat(Array.isArray(chosen.servers) ? chosen.servers.map((s) => s.url || s) : [])
      .filter(Boolean);
    if (altList[serverIndex - 1]) {
      candidateUrl = altList[serverIndex - 1];
    }
  }

  // Step 2: getLiveByRedirect
  const pRed = {
    ...basePayload,
    id: cleanId,
    url: candidateUrl,
    agent: chosen.agent || ''
  };
  const rRed = await axios.post(
    `${redirectServer}getLiveByRedirect`,
    JSON.stringify(encryptPayload(pRed)),
    { headers, timeout, transformResponse: [(d) => d] }
  );

  const decRed = decryptAndParseJson(rRed.data);
  const rawUrl = decRed?.data?.url ?? decRed?.url ?? candidateUrl;
  return parseRedirectDescriptor(rawUrl, chosen.agent || DEFAULT_USER_AGENT);
}

/**
 * Helper to POST an encrypted payload to a Drama Live endpoint with automatic fallback paths.
 */
async function postEncryptedWithFallback(urls, payloadObj, timeout = 12000) {
  const headers = {
    'User-Agent': DEFAULT_USER_AGENT,
    'Content-Type': 'application/json; charset=utf-8',
    Accept: 'application/json, text/plain, */*'
  };
  const body = JSON.stringify(encryptPayload(payloadObj));
  let lastError = null;

  for (const endpoint of urls) {
    try {
      const resp = await axios.post(endpoint, body, {
        headers,
        timeout,
        transformResponse: [(d) => d]
      });
      if (resp.status >= 200 && resp.status < 300 && resp.data) {
        return decryptAndParseJson(resp.data);
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('تعذر الاتصال بخوادم Drama Live');
}

/**
 * Generates a realistic FG encrypted bouquet for code `ARN2026` / `000000`
 * so users & automated tests can verify AES-128-CBC + k9x_ Swap locally.
 */
function buildSimulatedFgBouquet(code) {
  const cleanCode = String(code || 'ARN2026').trim();
  const rawEncryptedPacket = encryptPayload({
    playlistName: `باقة ARN المشفرة (FG Engine — كود ${cleanCode})`,
    topics: [
      { id: 'fg_sports', name: '⚽ قنوات رياضية مشفرة (FG k9x_)' },
      { id: 'fg_news', name: '🌍 قنوات إخبارية مباشرة (FG)' },
      { id: 'fg_cinema', name: '🎬 قنوات الأفلام والدراما (FG)' }
    ],
    channels: [
      {
        id: 'arn_fg_101',
        topic: 'fg_sports',
        name: 'ARN Sports 1 UHD (محرك FG + إزالة k9x_)',
        quality: 'FHD',
        serversCount: 3
      },
      {
        id: 'arn_fg_102',
        topic: 'fg_sports',
        name: 'ARN Sports 2 HD (بث مشفر متعدد الجودات)',
        quality: 'FHD',
        serversCount: 2
      },
      {
        id: 'arn_fg_201',
        topic: 'fg_news',
        name: 'ARN News الإخبارية HD',
        quality: 'HD',
        serversCount: 2
      },
      {
        id: 'arn_fg_301',
        topic: 'fg_cinema',
        name: 'ARN Drama سينما عربية FHD',
        quality: 'FHD',
        serversCount: 2
      }
    ]
  });

  const parsed = decryptAndParseJson(rawEncryptedPacket);
  const categories = parsed.topics.map((t, idx) => ({
    externalId: t.id,
    name: t.name,
    contentType: 'live',
    sortOrder: idx
  }));

  const channels = parsed.channels.map((ch, idx) => {
    const servers = [];
    for (let s = 0; s < (ch.serversCount || 2); s++) {
      servers.push({
        name: s === 0 ? 'سيرفر 1 (الرئيسي - FG)' : `سيرفر ${s + 1} (احتياطي - FG)`,
        url: `fg://${ch.id}?code=${encodeURIComponent(cleanCode)}&srv=${s}`
      });
    }
    return {
      externalId: ch.id,
      categoryExternalId: ch.topic,
      groupTitle: parsed.topics.find((t) => t.id === ch.topic)?.name || 'عام',
      name: ch.name,
      contentType: 'live',
      logo: '',
      streamUrl: servers[0].url,
      servers,
      meta: { quality: ch.quality, fgCode: cleanCode, fgId: ch.id },
      sortOrder: idx
    };
  });

  return {
    playlistName: parsed.playlistName,
    categories,
    channels
  };
}

/**
 * Imports a full Drama Live bouquet using an activation code (e.g. `202122` or `ARN2026`).
 * Emits progress updates via `onProgress({ percent, message })`.
 *
 * @param {string} code
 * @param {(p: {percent: number, message: string}) => void} [onProgress]
 * @returns {Promise<{ playlistName: string, categories: Array, channels: Array }>}
 */
async function importFgBouquet(code, onProgress = () => {}) {
  const cleanCode = String(code || '').trim();
  if (!cleanCode) {
    throw new Error('يرجى إدخال كود التفعيل أولاً');
  }

  onProgress({ percent: 8, message: `جاري التحقق من كود التفعيل (${cleanCode}) وفك التشفير...` });

  if (isSimulatedFgCode(cleanCode)) {
    onProgress({ percent: 55, message: 'جاري فك تشفير حزم AES-128-CBC وبناء القنوات...' });
    const result = buildSimulatedFgBouquet(cleanCode);
    onProgress({ percent: 100, message: `تم استيراد ${result.channels.length} قناة بنجاح` });
    return result;
  }

  // Query Drama Live v13.0.0 Categories / Topics
  const basePayload = buildDramaPayload(cleanCode);
  const topicsData = await postEncryptedWithFallback(
    [
      `${DEFAULT_MAIN_SERVER}getTopics`,
      `${DEFAULT_MAIN_SERVER}getCategories`,
      `${DEFAULT_LIVE_SERVER}getTopics`
    ],
    basePayload,
    12000
  );

  const rawTopics =
    topicsData.topics ||
    topicsData.categories ||
    topicsData.data ||
    (Array.isArray(topicsData) ? topicsData : []);

  if (!Array.isArray(rawTopics) || rawTopics.length === 0) {
    throw new Error('لم يُرجع الخادم أي تصنيفات لهذا الكود — تأكد من صحة كود التفعيل واتصال الإنترنت');
  }

  const categories = [];
  const channels = [];

  rawTopics.forEach((t, idx) => {
    const extId = String(t.id ?? t._id ?? t.topic_id ?? idx);
    const catName = String(t.name || t.title || t.title_ar || `تصنيف ${idx + 1}`).trim();
    categories.push({
      externalId: extId,
      name: catName,
      contentType: 'live',
      sortOrder: idx
    });
  });

  onProgress({
    percent: 25,
    message: `تم جلب ${categories.length} تصنيفاً — جاري تحميل القنوات...`
  });

  // Fetch channels per category with controlled concurrency (4 at a time)
  const concurrency = 4;
  let completedTopics = 0;

  for (let i = 0; i < rawTopics.length; i += concurrency) {
    const batch = rawTopics.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (topic, batchIdx) => {
        const catInfo = categories[i + batchIdx];
        const topicPayload = buildDramaPayload(cleanCode, catInfo.externalId);

        let chList = Array.isArray(topic.channels)
          ? topic.channels
          : Array.isArray(topic.live)
            ? topic.live
            : null;

        if (!chList) {
          try {
            const chResp = await postEncryptedWithFallback(
              [
                `${DEFAULT_LIVE_SERVER}getLiveByTopic`,
                `${DEFAULT_LIVE_SERVER}getLive`,
                `${DEFAULT_MAIN_SERVER}getLiveByTopic`
              ],
              topicPayload,
              10000
            );
            chList = chResp.live || chResp.channels || chResp.data || [];
          } catch (_err) {
            chList = [];
          }
        }

        if (Array.isArray(chList)) {
          chList.forEach((ch, cIdx) => {
            const chId = String(ch.id ?? ch.id_live ?? ch._id ?? `${catInfo.externalId}_${cIdx}`);
            const chName = String(ch.name || ch.title || `قناة ${cIdx + 1}`).trim();
            const logo = String(ch.logo || ch.image || ch.img || ch.icon || '').trim();
            const serverCount = Math.max(
              1,
              Array.isArray(ch.servers) ? ch.servers.length : ch.url2 ? 2 : 2
            );

            const servers = [];
            for (let s = 0; s < serverCount; s++) {
              servers.push({
                name: s === 0 ? 'سيرفر 1 (رئيسي)' : `سيرفر ${s + 1} (احتياطي)`,
                url: `fg://${chId}?code=${encodeURIComponent(cleanCode)}&srv=${s}`
              });
            }

            channels.push({
              externalId: chId,
              categoryExternalId: catInfo.externalId,
              groupTitle: catInfo.name,
              name: chName,
              contentType: 'live',
              logo,
              streamUrl: servers[0].url,
              servers,
              meta: {
                fgCode: cleanCode,
                fgId: chId,
                quality: /4k|uhd/i.test(chName)
                  ? '4K'
                  : /fhd|1080/i.test(chName)
                    ? 'FHD'
                    : /hd|720/i.test(chName)
                      ? 'HD'
                      : 'SD'
              },
              sortOrder: cIdx
            });
          });
        }

        completedTopics += 1;
        const pct = Math.min(95, 25 + Math.round((completedTopics / rawTopics.length) * 70));
        onProgress({
          percent: pct,
          message: `تمت معالجة ${completedTopics} من ${rawTopics.length} فئة (${channels.length} قناة)...`
        });
      })
    );
  }

  onProgress({ percent: 100, message: `اكتمل استيراد ${channels.length} قناة بنجاح` });

  return {
    playlistName: `Drama Live (${cleanCode})`,
    categories,
    channels
  };
}

module.exports = {
  DRAMA_KEY,
  DRAMA_IV,
  DEFAULT_USER_AGENT,
  encryptPayload,
  decryptPayload,
  decryptAndParseJson,
  buildDramaPayload,
  parseRedirectDescriptor,
  isSimulatedFgCode,
  resolveFgStream,
  importFgBouquet
};
