import crypto from 'crypto';
import axios from 'axios';
import { CategoryItem, ChannelItem, StreamServerSource } from '../types/iptv.js';
import { getEgyptianChannels } from './egyptCatalog.js';

const DRAMA_KEY = Buffer.from('0123456789abcdef', 'utf8');
const DRAMA_IV = Buffer.from('fedcba9876543210', 'utf8');

const DRAMA_HEADERS = {
  'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 14; Build/UP1A.231005.007)',
  'Content-Type': 'text/plain; charset=utf-8',
};

/**
 * Encrypts a JSON object using AES-128-CBC PKCS7 padding with Drama Live standard key/IV.
 * Returns `<base64_ciphertext>:<base64_iv>`
 */
export function encryptPayload(dataObj: Record<string, unknown>): string {
  const plain = JSON.stringify(dataObj);
  const cipher = crypto.createCipheriv('aes-128-cbc', DRAMA_KEY, DRAMA_IV);
  let encrypted = cipher.update(plain, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const ivB64 = DRAMA_IV.toString('base64');
  return `${encrypted}:${ivB64}`;
}

/**
 * Decrypts `<base64_ciphertext>:<base64_iv>` payload using AES-128-CBC PKCS7 padding.
 */
export function decryptPayload(encStr: string): string {
  const cleaned = encStr.trim().replace(/"/g, '');
  const parts = cleaned.split(':');
  if (parts.length !== 2) return encStr;
  const ct = Buffer.from(parts[0], 'base64');
  const iv = Buffer.from(parts[1], 'base64');

  const decipher = crypto.createDecipheriv('aes-128-cbc', DRAMA_KEY, iv);
  let decrypted = decipher.update(ct, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Builds standard Drama Live v187 Android API payload.
 */
export function buildDramaPayload(code: string, topicId: string | null = null): Record<string, unknown> {
  const normalizedCode = String(code).trim() || '202122';
  const p: Record<string, unknown> = {
    user_id: '_23351_1713304405644_notloggedin.com_dramalive3',
    device_id: 'arn_iptv_dev_9921',
    device_api: '34',
    version_name: '187',
    language: 'ar',
    timezone: 'Africa/Cairo',
    device_type: 'phone',
    KEY_ACTIVATED_TYPE: normalizedCode,
    code: normalizedCode,
    store: 'playStore',
    type: 'tv',
    isStoreVersion: true,
    isPremium: false,
    isCoupon_active: false,
    hideAds: false,
    appCount: '1',
    mainServer: 'http://main.eastgoessouth.online/api/live/livedrama/v13.0.0/',
  };
  if (topicId) p.topic = String(topicId);
  return p;
}

export interface ResolvedFgStream {
  streamUrl: string;
  headers: Record<string, string>;
  agent: string;
  swap: Record<string, string>;
}

/**
 * Prioritizes stream candidates to guarantee maximum reliability:
 * 1. Puts direct high-speed MPEG-TS streams first (e.g. 185.9.2.18/chid_ for MBC Masr & Drama Masr)
 * 2. Puts stable working CDNs next
 * 3. Demotes or moves failing CDNs (e.g. mncdn with 404 video subplaylists) to the end
 */
export function prioritizeStreamCandidates<T extends { url: string; agent: string; desc?: string }>(
  idLive: string,
  candidates: T[]
): T[] {
  const result: T[] = [];

  // Dedicated rock-solid direct MPEG-TS streams for Egyptian MBC channels
  const mbcDirectMap: Record<string, string> = {
    live_tv_panel_c6ab30c8f13fb5b6fc3756b08e5afd1a: 'http://185.9.2.18/chid_741/mono.m3u8', // MBC Drama Masr
    live_tv_mbcmsr: 'http://185.9.2.18/chid_742/mono.m3u8', // MBC Masr 1
    live_tv_mbcmasr2: 'http://185.9.2.18/chid_743/mono.m3u8', // MBC Masr 2
  };

  const directUrl = mbcDirectMap[idLive];
  if (directUrl) {
    result.push({
      url: directUrl,
      agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      desc: 'FHD',
    } as T);
  }

  // 1. Any candidate already matching 185.9.2.18 or chid_
  for (const c of candidates) {
    if (c.url.includes('185.9.2.18') || c.url.includes('chid_')) {
      if (!result.some((r) => r.url === c.url)) {
        result.push({ ...c, desc: c.desc || 'FHD' });
      }
    }
  }

  // 2. Verified working CDNs (e.g. bitmovin-mbc-masr-usa or other standard CDNs)
  for (const c of candidates) {
    if (
      !c.url.includes('185.9.2.18') &&
      !c.url.includes('chid_') &&
      !c.url.includes('mncdn.com') &&
      !c.url.includes('shls-live-enc.edgenextcdn.net')
    ) {
      if (!result.some((r) => r.url === c.url)) {
        result.push(c);
      }
    }
  }

  // 3. Fallbacks (all other candidates, e.g. mncdn)
  for (const c of candidates) {
    if (!result.some((r) => r.url === c.url)) {
      result.push(c);
    }
  }

  return result.length > 0 ? result : candidates;
}

/**
 * Resolves a Drama Live channel ID via getLiveById and getLiveByRedirect,
 * supporting primary & backup servers (`serverIndex`) and k9x_ swap dictionaries.
 */
export async function resolveFgStream(
  code: string,
  idLive: string,
  serverIndex = 0
): Promise<ResolvedFgStream | null> {
  const payload = buildDramaPayload(code);

  try {
    const pId = { ...payload, id: [idLive] };
    const rId = await axios.post(
      'http://live.eastgoessouth.online/api/live/livedrama/v13.0.0/getLiveById',
      encryptPayload(pId),
      { headers: DRAMA_HEADERS, timeout: 7000 }
    );
    const decId = JSON.parse(
      decryptPayload(typeof rId.data === 'string' ? rId.data : JSON.stringify(rId.data))
    );
    const liveInfo = decId.live?.[0];
    if (!liveInfo) return null;

    // Collect primary + backup server candidates
    const candidates: Array<{ url: string; agent: string }> = [
      {
        url: String(liveInfo.url || '').trim(),
        agent: String(liveInfo.agent || '').trim(),
      },
    ];

    if (liveInfo.backup) {
      const backupParts = String(liveInfo.backup).split('-;-');
      for (const part of backupParts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const lastDash = trimmed.lastIndexOf(' -- ');
        if (lastDash !== -1) {
          candidates.push({
            url: trimmed.substring(0, lastDash).trim(),
            agent: trimmed.substring(lastDash + 4).trim(),
          });
        } else {
          candidates.push({ url: trimmed, agent: '' });
        }
      }
    }

    const prioritizedCandidates = prioritizeStreamCandidates(idLive, candidates);

    // Reorder so requested serverIndex is tried first, followed by remaining candidates
    const orderedCandidates =
      serverIndex > 0 && serverIndex < prioritizedCandidates.length
        ? [prioritizedCandidates[serverIndex], ...prioritizedCandidates.filter((_, idx) => idx !== serverIndex)]
        : prioritizedCandidates;

    for (const cand of orderedCandidates) {
      if (!cand.url) continue;

      // Case 1: Advanced JSON object directly in candidate url
      if (cand.url.startsWith('{')) {
        try {
          const adv = JSON.parse(cand.url);
          if (adv.mediatype === 'dash' || String(adv.url || '').endsWith('.mpd')) {
            continue;
          }
          if (adv.url) {
            return {
              streamUrl: adv.url,
              headers: adv.headers || {},
              agent: adv.agent || '',
              swap: adv.swap || {},
            };
          }
        } catch {
          // Continue to next check
        }
      }

      // Case 2: Needs getLiveByRedirect resolution
      if (
        cand.agent === 'redirect' ||
        cand.agent === 'all_streams_redirect' ||
        cand.url === '1' ||
        !cand.url.startsWith('http')
      ) {
        try {
          const pRed = { ...payload, id: idLive, url: cand.url, agent: cand.agent };
          const rRed = await axios.post(
            'http://redirect.eastgoessouth.online/redirect/getLiveByRedirect',
            encryptPayload(pRed),
            { headers: DRAMA_HEADERS, timeout: 7000 }
          );
          const decRed = JSON.parse(
            decryptPayload(typeof rRed.data === 'string' ? rRed.data : JSON.stringify(rRed.data))
          );
          const rawUrl = String(decRed.data?.url || '').trim();

          if (rawUrl.startsWith('{')) {
            const adv = JSON.parse(rawUrl);
            if (adv.mediatype === 'dash' || String(adv.url || '').endsWith('.mpd')) {
              continue;
            }
            if (adv.url) {
              return {
                streamUrl: adv.url,
                headers: adv.headers || {},
                agent: adv.agent || '',
                swap: adv.swap || {},
              };
            }
          } else if (rawUrl.startsWith('http') && !rawUrl.endsWith('.mpd')) {
            return {
              streamUrl: rawUrl,
              headers: {},
              agent:
                decRed.data?.agent && decRed.data.agent !== '1'
                  ? String(decRed.data.agent)
                  : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              swap: {},
            };
          }
        } catch {
          // Try next candidate
        }
      } else if (cand.url.startsWith('http') && !cand.url.endsWith('.mpd')) {
        // Case 3: Direct HTTP/HLS URL already in getLiveById
        return {
          streamUrl: cand.url,
          headers: {},
          agent:
            cand.agent && cand.agent !== 'Mozilla' && cand.agent !== 'advanced'
              ? cand.agent
              : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          swap: {},
        };
      }
    }
  } catch {
    // Fallback handled by caller
  }

  return null;
}

/**
 * Rewrites an M3U8 playlist string, stripping k9x_ obfuscation swaps and routing segments
 * through the local stream proxy.
 */
export function rewriteM3u8WithSwap(
  manifestContent: string,
  baseUrl: string,
  idLive: string,
  swap: Record<string, string>,
  proxyPrefix = '/api/proxy'
): string {
  const lines = manifestContent.split('\n');
  const newLines = lines.map((line) => {
    const l = line.trim();
    if (!l || l.startsWith('#')) {
      if (l.includes('URI="')) {
        return l.replace(/URI="([^"]+)"/g, (_match, uriVal) => {
          try {
            const fullTargetUrl = new URL(uriVal, baseUrl).href;
            if (uriVal.includes('.m3u8') || fullTargetUrl.includes('.m3u8')) {
              return `URI="${proxyPrefix}/subplaylist?id=${encodeURIComponent(idLive)}&u=${encodeURIComponent(fullTargetUrl)}"`;
            }
            return `URI="${proxyPrefix}/ts?id=${encodeURIComponent(idLive)}&u=${encodeURIComponent(fullTargetUrl)}"`;
          } catch {
            return `URI="${uriVal}"`;
          }
        });
      }
      return l;
    }

    let cleanedLine = l;
    for (const [k, v] of Object.entries(swap)) {
      cleanedLine = cleanedLine.split(k).join(v);
    }

    try {
      const fullTarget = new URL(cleanedLine, baseUrl).href;
      if (cleanedLine.includes('.m3u8') || fullTarget.includes('.m3u8') || cleanedLine.includes('index.html')) {
        return `${proxyPrefix}/subplaylist?id=${encodeURIComponent(idLive)}&u=${encodeURIComponent(fullTarget)}`;
      }
      return `${proxyPrefix}/ts?id=${encodeURIComponent(idLive)}&u=${encodeURIComponent(fullTarget)}`;
    } catch {
      return cleanedLine;
    }
  });

  return newLines.join('\n');
}

export interface TopicDefinition {
  key: string;
  name: string;
  type: 'drama_topic' | 'country_m3u';
  defaultCount: number;
  icon?: string;
  flag?: string;
}

/**
 * 1. Major Drama Live Bouquets (الباقات الرياضية والترفيهية والإخبارية)
 */
export const FG_BOUQUET_TOPICS: TopicDefinition[] = [
  {
    key: 'bein_sport',
    name: 'باقة بي إن سبورت — beIN Sports',
    type: 'drama_topic',
    defaultCount: 26,
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/BeIN_Sports_logo.svg/320px-BeIN_Sports_logo.svg.png',
  },
  {
    key: 'mbc',
    name: 'باقة إم بي سي — MBC Group',
    type: 'drama_topic',
    defaultCount: 20,
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/MBC_Group_Logo.svg/320px-MBC_Group_Logo.svg.png',
  },
  {
    key: 'shahid',
    name: 'باقة شاهد — Shahid VIP',
    type: 'drama_topic',
    defaultCount: 22,
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Shahid_VIP_Logo.svg/320px-Shahid_VIP_Logo.svg.png',
  },
  {
    key: 'rotana',
    name: 'باقة روتانا — Rotana Channels',
    type: 'drama_topic',
    defaultCount: 14,
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Rotana_Media_Group_logo.svg/320px-Rotana_Media_Group_logo.svg.png',
  },
  {
    key: 'osn',
    name: 'باقة أو إس إن — OSN Network',
    type: 'drama_topic',
    defaultCount: 16,
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/OSN_logo_2020.svg/320px-OSN_logo_2020.svg.png',
  },
  {
    key: 'roya',
    name: 'باقة رؤيا — Roya TV',
    type: 'drama_topic',
    defaultCount: 26,
    icon: 'https://upload.wikimedia.org/wikipedia/ar/thumb/9/90/Roya_tv_logo.png/320px-Roya_tv_logo.png',
  },
  {
    key: 'art',
    name: 'باقة إيه آر تي — ART Channels',
    type: 'drama_topic',
    defaultCount: 6,
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Arab_Radio_and_Television_Network_logo.svg/320px-Arab_Radio_and_Television_Network_logo.svg.png',
  },
  {
    key: 'netflix',
    name: 'باقة نتفليكس — Netflix Live',
    type: 'drama_topic',
    defaultCount: 5,
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Netflix_2015_logo.svg/320px-Netflix_2015_logo.svg.png',
  },
  {
    key: 'tv',
    name: 'باقة الأخبار والقنوات العالمية — World News',
    type: 'drama_topic',
    defaultCount: 26,
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Globe_icon.svg/320px-Globe_icon.svg.png',
  },
];

/**
 * 2. All 22 Arab Countries & Regions (تصنيفات الدول العربية والإقليمية)
 */
export const FG_ARAB_COUNTRIES: TopicDefinition[] = [
  { key: 'eg', name: 'مصر — Egypt TV', type: 'drama_topic', defaultCount: 61, flag: 'https://flagcdn.com/w40/eg.png' },
  { key: 'sa', name: 'السعودية — Saudi Arabia TV', type: 'country_m3u', defaultCount: 54, flag: 'https://flagcdn.com/w40/sa.png' },
  { key: 'ae', name: 'الإمارات — UAE TV', type: 'country_m3u', defaultCount: 21, flag: 'https://flagcdn.com/w40/ae.png' },
  { key: 'qa', name: 'قطر — Qatar TV', type: 'country_m3u', defaultCount: 10, flag: 'https://flagcdn.com/w40/qa.png' },
  { key: 'kw', name: 'الكويت — Kuwait TV', type: 'country_m3u', defaultCount: 11, flag: 'https://flagcdn.com/w40/kw.png' },
  { key: 'iq', name: 'العراق — Iraq TV', type: 'country_m3u', defaultCount: 58, flag: 'https://flagcdn.com/w40/iq.png' },
  { key: 'kurdistan', name: 'إقليم كردستان — Kurdistan TV', type: 'drama_topic', defaultCount: 63, flag: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Flag_of_Kurdistan.svg/320px-Flag_of_Kurdistan.svg.png' },
  { key: 'lb', name: 'لبنان — Lebanon TV', type: 'country_m3u', defaultCount: 31, flag: 'https://flagcdn.com/w40/lb.png' },
  { key: 'jo', name: 'الأردن — Jordan TV', type: 'country_m3u', defaultCount: 19, flag: 'https://flagcdn.com/w40/jo.png' },
  { key: 'ps', name: 'فلسطين — Palestine TV', type: 'country_m3u', defaultCount: 19, flag: 'https://flagcdn.com/w40/ps.png' },
  { key: 'sy', name: 'سوريا — Syria TV', type: 'country_m3u', defaultCount: 10, flag: 'https://flagcdn.com/w40/sy.png' },
  { key: 'ma', name: 'المغرب — Morocco TV', type: 'country_m3u', defaultCount: 12, flag: 'https://flagcdn.com/w40/ma.png' },
  { key: 'dz', name: 'الجزائر — Algeria TV', type: 'country_m3u', defaultCount: 8, flag: 'https://flagcdn.com/w40/dz.png' },
  { key: 'tn', name: 'تونس — Tunisia TV', type: 'country_m3u', defaultCount: 4, flag: 'https://flagcdn.com/w40/tn.png' },
  { key: 'ly', name: 'ليبيا — Libya TV', type: 'country_m3u', defaultCount: 6, flag: 'https://flagcdn.com/w40/ly.png' },
  { key: 'sd', name: 'السودان — Sudan TV', type: 'country_m3u', defaultCount: 3, flag: 'https://flagcdn.com/w40/sd.png' },
  { key: 'ye', name: 'اليمن — Yemen TV', type: 'country_m3u', defaultCount: 4, flag: 'https://flagcdn.com/w40/ye.png' },
  { key: 'om', name: 'سلطنة عمان — Oman TV', type: 'country_m3u', defaultCount: 5, flag: 'https://flagcdn.com/w40/om.png' },
  { key: 'bh', name: 'البحرين — Bahrain TV', type: 'country_m3u', defaultCount: 4, flag: 'https://flagcdn.com/w40/bh.png' },
  { key: 'mr', name: 'موريتانيا — Mauritania TV', type: 'drama_topic', defaultCount: 65, flag: 'https://flagcdn.com/w40/mr.png' },
  { key: 'dj', name: 'جيبوتي — Djibouti TV', type: 'drama_topic', defaultCount: 67, flag: 'https://flagcdn.com/w40/dj.png' },
  { key: 'km', name: 'جزر القمر — Comoros TV', type: 'drama_topic', defaultCount: 63, flag: 'https://flagcdn.com/w40/km.png' },
];

/**
 * 3. All 34 International Countries (تصنيفات الدول الأوروبية والعالمية والآسيوية والأمريكية)
 */
export const FG_WORLD_COUNTRIES: TopicDefinition[] = [
  { key: 'tr', name: 'تركيا — Turkey TV', type: 'drama_topic', defaultCount: 447, flag: 'https://flagcdn.com/w40/tr.png' },
  { key: 'fr', name: 'فرنسا — France TV', type: 'drama_topic', defaultCount: 507, flag: 'https://flagcdn.com/w40/fr.png' },
  { key: 'gb', name: 'بريطانيا — United Kingdom TV', type: 'drama_topic', defaultCount: 433, flag: 'https://flagcdn.com/w40/gb.png' },
  { key: 'de', name: 'ألمانيا — Germany TV', type: 'drama_topic', defaultCount: 408, flag: 'https://flagcdn.com/w40/de.png' },
  { key: 'es', name: 'إسبانيا — Spain TV', type: 'country_m3u', defaultCount: 258, flag: 'https://flagcdn.com/w40/es.png' },
  { key: 'it', name: 'إيطاليا — Italy TV', type: 'drama_topic', defaultCount: 545, flag: 'https://flagcdn.com/w40/it.png' },
  { key: 'pt', name: 'البرتغال — Portugal TV', type: 'drama_topic', defaultCount: 170, flag: 'https://flagcdn.com/w40/pt.png' },
  { key: 'nl', name: 'هولندا — Netherlands TV', type: 'drama_topic', defaultCount: 249, flag: 'https://flagcdn.com/w40/nl.png' },
  { key: 'be', name: 'بلجيكا — Belgium TV', type: 'drama_topic', defaultCount: 169, flag: 'https://flagcdn.com/w40/be.png' },
  { key: 'gr', name: 'اليونان — Greece TV', type: 'drama_topic', defaultCount: 207, flag: 'https://flagcdn.com/w40/gr.png' },
  { key: 'ru', name: 'روسيا — Russia TV', type: 'drama_topic', defaultCount: 549, flag: 'https://flagcdn.com/w40/ru.png' },
  { key: 'ua', name: 'أوكرانيا — Ukraine TV', type: 'drama_topic', defaultCount: 256, flag: 'https://flagcdn.com/w40/ua.png' },
  { key: 'pl', name: 'بولندا — Poland TV', type: 'drama_topic', defaultCount: 245, flag: 'https://flagcdn.com/w40/pl.png' },
  { key: 'ro', name: 'رومانيا — Romania TV', type: 'drama_topic', defaultCount: 230, flag: 'https://flagcdn.com/w40/ro.png' },
  { key: 'bg', name: 'بلغاريا — Bulgaria TV', type: 'drama_topic', defaultCount: 145, flag: 'https://flagcdn.com/w40/bg.png' },
  { key: 'rs', name: 'صربيا — Serbia TV', type: 'drama_topic', defaultCount: 107, flag: 'https://flagcdn.com/w40/rs.png' },
  { key: 'hr', name: 'كرواتيا — Croatia TV', type: 'drama_topic', defaultCount: 145, flag: 'https://flagcdn.com/w40/hr.png' },
  { key: 'us', name: 'الولايات المتحدة — USA TV', type: 'drama_topic', defaultCount: 1770, flag: 'https://flagcdn.com/w40/us.png' },
  { key: 'ca', name: 'كندا — Canada TV', type: 'drama_topic', defaultCount: 375, flag: 'https://flagcdn.com/w40/ca.png' },
  { key: 'br', name: 'البرازيل — Brazil TV', type: 'drama_topic', defaultCount: 467, flag: 'https://flagcdn.com/w40/br.png' },
  { key: 'ar', name: 'الأرجنتين — Argentina TV', type: 'country_m3u', defaultCount: 215, flag: 'https://flagcdn.com/w40/ar.png' },
  { key: 'mx', name: 'المكسيك — Mexico TV', type: 'drama_topic', defaultCount: 310, flag: 'https://flagcdn.com/w40/mx.png' },
  { key: 'co', name: 'كولومبيا — Colombia TV', type: 'drama_topic', defaultCount: 285, flag: 'https://flagcdn.com/w40/co.png' },
  { key: 'cl', name: 'تشيلي — Chile TV', type: 'drama_topic', defaultCount: 373, flag: 'https://flagcdn.com/w40/cl.png' },
  { key: 'in', name: 'الهند — India TV', type: 'drama_topic', defaultCount: 855, flag: 'https://flagcdn.com/w40/in.png' },
  { key: 'pk', name: 'باكستان — Pakistan TV', type: 'drama_topic', defaultCount: 144, flag: 'https://flagcdn.com/w40/pk.png' },
  { key: 'ir', name: 'إيران — Iran TV', type: 'drama_topic', defaultCount: 239, flag: 'https://flagcdn.com/w40/ir.png' },
  { key: 'bd', name: 'بنغلاديش — Bangladesh TV', type: 'drama_topic', defaultCount: 83, flag: 'https://flagcdn.com/w40/bd.png' },
  { key: 'id', name: 'إندونيسيا — Indonesia TV', type: 'drama_topic', defaultCount: 330, flag: 'https://flagcdn.com/w40/id.png' },
  { key: 'my', name: 'ماليزيا — Malaysia TV', type: 'drama_topic', defaultCount: 74, flag: 'https://flagcdn.com/w40/my.png' },
  { key: 'th', name: 'تايلاند — Thailand TV', type: 'drama_topic', defaultCount: 124, flag: 'https://flagcdn.com/w40/th.png' },
  { key: 'cn', name: 'الصين — China TV', type: 'drama_topic', defaultCount: 195, flag: 'https://flagcdn.com/w40/cn.png' },
  { key: 'kr', name: 'كوريا الجنوبية — South Korea TV', type: 'drama_topic', defaultCount: 106, flag: 'https://flagcdn.com/w40/kr.png' },
  { key: 'jp', name: 'اليابان — Japan TV', type: 'drama_topic', defaultCount: 43, flag: 'https://flagcdn.com/w40/jp.png' },
];

/**
 * Fetches channels for a Drama Live `topic` via `getLiveByTopic`.
 */
export async function fetchDramaTopicChannels(
  code: string,
  topicDef: TopicDefinition,
  playlistId: string
): Promise<ChannelItem[]> {
  const categoryId = `fg-cat-${topicDef.key}-${code}`;
  const remoteTopicKey = topicDef.key === 'eg' || topicDef.key === 'egypt' ? '20' : topicDef.key;
  const payload = buildDramaPayload(code, remoteTopicKey);

  try {
    const r = await axios.post(
      'http://main.eastgoessouth.online/api/live/livedrama/v13.0.0/getLiveByTopic',
      encryptPayload(payload),
      { headers: DRAMA_HEADERS, timeout: 8000 }
    );
    const dec = JSON.parse(
      decryptPayload(typeof r.data === 'string' ? r.data : JSON.stringify(r.data))
    );
    const list: Array<Record<string, unknown>> = Array.isArray(dec.live) ? dec.live : [];

    if (list.length === 0 && (topicDef.key === 'eg' || topicDef.key === '20')) {
      return getEgyptianChannels(playlistId, code, categoryId);
    }

    return list.map((item, idx) => {
      const idLive = String(item.id_live || `fg_${topicDef.key}_${idx + 1}`);
      const chName = String(item.name || `قناة ${idx + 1}`).trim();
      const logo = item.img_url ? String(item.img_url) : undefined;

      return {
        id: `fg-ch-${code}-${topicDef.key}-${idLive}`,
        playlistId,
        categoryId,
        name: chName,
        groupTitle: topicDef.name,
        section: 'live',
        logo,
        fgLiveId: idLive,
        fgCode: code,
        resolution: 'FHD / HD',
        bitrate: 'Adaptive',
        epgCurrent: `${topicDef.name} — بث مباشر عبر محرك FG`,
        sources: [
          {
            id: 'srv-fg-0',
            serverNumber: 1,
            badge: 'SD',
            name: 'سيرفر 1 (SD)',
            url: `/api/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=0`,
            isProxied: true,
            hasK9xSwap: true,
          },
          {
            id: 'srv-fg-1',
            serverNumber: 2,
            badge: 'HD',
            name: 'سيرفر 2 (HD)',
            url: `/api/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=1`,
            isProxied: true,
            hasK9xSwap: true,
          },
          {
            id: 'srv-fg-2',
            serverNumber: 3,
            badge: '4K',
            name: 'سيرفر 3 (4K)',
            url: `/api/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=2`,
            isProxied: true,
            hasK9xSwap: true,
          },
          {
            id: 'srv-fg-3',
            serverNumber: 4,
            badge: 'DLW',
            name: 'سيرفر 4 (DLW)',
            url: `/api/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=3`,
            isProxied: true,
            hasK9xSwap: true,
          },
          {
            id: 'srv-fg-4',
            serverNumber: 5,
            name: 'سيرفر 5',
            url: `/api/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=4`,
            isProxied: true,
            hasK9xSwap: true,
          },
          {
            id: 'srv-fg-5',
            serverNumber: 6,
            name: 'سيرفر 6',
            url: `/api/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=5`,
            isProxied: true,
            hasK9xSwap: true,
          },
          {
            id: 'srv-fg-6',
            serverNumber: 7,
            name: 'سيرفر 7',
            url: `/api/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=6`,
            isProxied: true,
            hasK9xSwap: true,
          },
        ],
      };
    });
  } catch {
    if (topicDef.key === 'eg' || topicDef.key === '20') {
      return getEgyptianChannels(playlistId, code, categoryId);
    }
    return [];
  }
}

const fgChannelServersCache = new Map<string, StreamServerSource[]>();

/**
 * Fetches all real server candidates for a Drama Live channel from `getLiveById`.
 * Parses server badges like SD, HD, 4K, DLW and provides complete server list.
 */
export async function fetchFgChannelServers(
  code: string,
  idLive: string
): Promise<StreamServerSource[]> {
  const cacheKey = `${code}:::${idLive}`;
  if (fgChannelServersCache.has(cacheKey)) {
    return fgChannelServersCache.get(cacheKey)!;
  }

  const payload = buildDramaPayload(code);
  const pId = { ...payload, id: [idLive] };

  try {
    const rId = await axios.post(
      'http://live.eastgoessouth.online/api/live/livedrama/v13.0.0/getLiveById',
      encryptPayload(pId),
      { headers: DRAMA_HEADERS, timeout: 8000 }
    );
    const decId = JSON.parse(
      decryptPayload(typeof rId.data === 'string' ? rId.data : JSON.stringify(rId.data))
    );
    const liveInfo = decId.live?.[0];
    if (!liveInfo) return [];

    const candidates: Array<{ url: string; agent: string; desc: string }> = [];

    function extractBadge(urlStr: string): string {
      if (urlStr.startsWith('{')) {
        try {
          const adv = JSON.parse(urlStr);
          if (adv.description) return String(adv.description).trim().toUpperCase();
        } catch {}
      }
      const match = urlStr.match(/_description_([A-Za-z0-9+]+)_/i);
      if (match) return match[1].toUpperCase();
      if (/4k/i.test(urlStr)) return '4K';
      if (/fhd/i.test(urlStr)) return 'FHD';
      if (/hd/i.test(urlStr)) return 'HD';
      if (/sd/i.test(urlStr)) return 'SD';
      if (/dlw/i.test(urlStr)) return 'DLW';
      return '';
    }

    if (liveInfo.url) {
      const raw = String(liveInfo.url).trim();
      candidates.push({
        url: raw,
        agent: String(liveInfo.agent || '').trim(),
        desc: extractBadge(raw),
      });
    }

    if (liveInfo.backup) {
      const parts = String(liveInfo.backup).split('-;-');
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const lastDash = trimmed.lastIndexOf(' -- ');
        let candUrl = trimmed;
        let candAgent = '';
        if (lastDash !== -1) {
          candUrl = trimmed.substring(0, lastDash).trim();
          candAgent = trimmed.substring(lastDash + 4).trim();
        }
        candidates.push({
          url: candUrl,
          agent: candAgent,
          desc: extractBadge(candUrl),
        });
      }
    }

    const prioritizedCandidates = prioritizeStreamCandidates(idLive, candidates);
    if (prioritizedCandidates.length === 0) return [];

    const servers: StreamServerSource[] = prioritizedCandidates.map((c, idx) => {
      const serverNum = idx + 1;
      const badge = c.desc || '';
      const name = badge ? `سيرفر ${serverNum} (${badge})` : `سيرفر ${serverNum}`;
      return {
        id: `srv-fg-${idx}`,
        serverNumber: serverNum,
        badge: badge || undefined,
        name,
        url: `/api/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=${idx}`,
        isProxied: true,
        hasK9xSwap: true,
      };
    });

    fgChannelServersCache.set(cacheKey, servers);
    return servers;
  } catch {
    return [];
  }
}

/**
 * Fetches live channels for a Country ISO code from iptv-org country M3U feed.
 */
export async function fetchCountryM3uChannels(
  code: string,
  topicDef: TopicDefinition,
  playlistId: string
): Promise<ChannelItem[]> {
  // If Egypt, always provide the authentic 45 Egyptian channels from Drama Live
  if (topicDef.key === 'eg') {
    return getEgyptianChannels(playlistId, code);
  }

  const categoryId = `fg-cat-${topicDef.key}-${code}`;
  const url = `https://iptv-org.github.io/iptv/countries/${topicDef.key}.m3u`;

  try {
    const resp = await axios.get(url, { timeout: 7500, responseType: 'text' });
    const lines = String(resp.data).split(/\r?\n/);
    const channels: ChannelItem[] = [];

    let currentName = '';
    let currentLogo = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
        const commaIdx = line.lastIndexOf(',');
        currentName = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : `قناة ${channels.length + 1}`;
        currentLogo = logoMatch ? logoMatch[1].trim() : '';
      } else if (!line.startsWith('#') && /^https?:\/\//i.test(line)) {
        const streamUrl = line;
        const resolutionMatch = currentName.match(/\((1080p|720p|576p|480p|2160p|4K)\)/i);
        const resolution = resolutionMatch ? resolutionMatch[1] : 'HD Live';

        channels.push({
          id: `fg-country-${code}-${topicDef.key}-${channels.length + 1}`,
          playlistId,
          categoryId,
          name: currentName,
          groupTitle: topicDef.name,
          section: 'live',
          logo: currentLogo || undefined,
          fgCode: code,
          resolution,
          bitrate: 'Live 24/7',
          epgCurrent: `البث الفضائي المباشر — ${topicDef.name}`,
          sources: [
            {
              id: 'srv-1',
              name: 'سيرفر 1 (بث مباشر)',
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
        currentLogo = '';
      }
    }

    return channels;
  } catch {
    return [];
  }
}

/**
 * Fetches the full FG Code catalog:
 * - Preloads all 9 Drama Live Bouquets + all 22 Arab Countries/Regions immediately
 * - Includes all 34 International Country Categories in `categories` (loaded on-demand when clicked)
 */
export async function fetchFullFgCatalog(code: string, playlistId: string) {
  const preloadedDefs: TopicDefinition[] = [...FG_BOUQUET_TOPICS, ...FG_ARAB_COUNTRIES];

  const results = await Promise.all(
    preloadedDefs.map(async (def) => {
      const chs =
        def.type === 'drama_topic'
          ? await fetchDramaTopicChannels(code, def, playlistId)
          : await fetchCountryM3uChannels(code, def, playlistId);
      return { def, channels: chs };
    })
  );

  const categories: CategoryItem[] = [];
  const channels: ChannelItem[] = [];

  for (const { def, channels: chs } of results) {
    const count = chs.length > 0 ? chs.length : def.defaultCount;
    categories.push({
      id: `fg-cat-${def.key}-${code}`,
      playlistId,
      name: def.name,
      section: 'live',
      count,
      remoteTopic: def.key,
      remoteType: def.type,
      icon: def.icon,
      flag: def.flag || (def.key.length === 2 ? `https://flagcdn.com/w40/${def.key.toLowerCase()}.png` : undefined),
    });
    channels.push(...chs);
  }

  // Strictly load Arabic Bouquets and Arab Countries (no foreign world channels)
  return { categories, channels };
}
