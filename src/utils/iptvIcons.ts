/**
 * Curated Bouquet Logos & Country Flags for ARN IPTV Pro
 * Supports Drama Live topics & arbitrary M3U group titles
 */

const createSvgBadge = (bg: string, fg: string, text: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 38"><rect width="70" height="38" rx="7" fill="${bg}"/><text x="35" y="24" fill="${fg}" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" text-anchor="middle" letter-spacing="0.5">${text}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const BOUQUET_ICONS: Record<string, string> = {
  bein: createSvgBadge('#4c1d95', '#ffffff', 'beIN'),
  mbc: createSvgBadge('#0284c7', '#ffffff', 'MBC'),
  shahid: createSvgBadge('#0f766e', '#facc15', 'SHAHID'),
  rotana: createSvgBadge('#15803d', '#ffffff', 'ROTANA'),
  osn: createSvgBadge('#dc2626', '#ffffff', 'OSN'),
  roya: createSvgBadge('#0284c7', '#ffffff', 'ROYA'),
  art: createSvgBadge('#b45309', '#ffffff', 'ART'),
  netflix: createSvgBadge('#09090b', '#e50914', 'NETFLIX'),
  news: createSvgBadge('#334155', '#38bdf8', 'NEWS'),
  kurdistan: 'https://flagcdn.com/w40/iq.png',
};

export const COUNTRY_FLAG_MAP: Record<string, string> = {
  // Arab Nations
  eg: 'https://flagcdn.com/w40/eg.png',
  sa: 'https://flagcdn.com/w40/sa.png',
  ae: 'https://flagcdn.com/w40/ae.png',
  qa: 'https://flagcdn.com/w40/qa.png',
  kw: 'https://flagcdn.com/w40/kw.png',
  iq: 'https://flagcdn.com/w40/iq.png',
  lb: 'https://flagcdn.com/w40/lb.png',
  jo: 'https://flagcdn.com/w40/jo.png',
  ps: 'https://flagcdn.com/w40/ps.png',
  sy: 'https://flagcdn.com/w40/sy.png',
  ma: 'https://flagcdn.com/w40/ma.png',
  dz: 'https://flagcdn.com/w40/dz.png',
  tn: 'https://flagcdn.com/w40/tn.png',
  ly: 'https://flagcdn.com/w40/ly.png',
  sd: 'https://flagcdn.com/w40/sd.png',
  ye: 'https://flagcdn.com/w40/ye.png',
  om: 'https://flagcdn.com/w40/om.png',
  bh: 'https://flagcdn.com/w40/bh.png',
  mr: 'https://flagcdn.com/w40/mr.png',
  dj: 'https://flagcdn.com/w40/dj.png',
  km: 'https://flagcdn.com/w40/km.png',

  // World Nations
  tr: 'https://flagcdn.com/w40/tr.png',
  fr: 'https://flagcdn.com/w40/fr.png',
  gb: 'https://flagcdn.com/w40/gb.png',
  uk: 'https://flagcdn.com/w40/gb.png',
  de: 'https://flagcdn.com/w40/de.png',
  es: 'https://flagcdn.com/w40/es.png',
  it: 'https://flagcdn.com/w40/it.png',
  pt: 'https://flagcdn.com/w40/pt.png',
  nl: 'https://flagcdn.com/w40/nl.png',
  be: 'https://flagcdn.com/w40/be.png',
  gr: 'https://flagcdn.com/w40/gr.png',
  ru: 'https://flagcdn.com/w40/ru.png',
  ua: 'https://flagcdn.com/w40/ua.png',
  pl: 'https://flagcdn.com/w40/pl.png',
  ro: 'https://flagcdn.com/w40/ro.png',
  bg: 'https://flagcdn.com/w40/bg.png',
  rs: 'https://flagcdn.com/w40/rs.png',
  hr: 'https://flagcdn.com/w40/hr.png',
  us: 'https://flagcdn.com/w40/us.png',
  usa: 'https://flagcdn.com/w40/us.png',
  ca: 'https://flagcdn.com/w40/ca.png',
  br: 'https://flagcdn.com/w40/br.png',
  ar: 'https://flagcdn.com/w40/ar.png',
  mx: 'https://flagcdn.com/w40/mx.png',
  co: 'https://flagcdn.com/w40/co.png',
  cl: 'https://flagcdn.com/w40/cl.png',
  in: 'https://flagcdn.com/w40/in.png',
  pk: 'https://flagcdn.com/w40/pk.png',
  ir: 'https://flagcdn.com/w40/ir.png',
  bd: 'https://flagcdn.com/w40/bd.png',
  id: 'https://flagcdn.com/w40/id.png',
  my: 'https://flagcdn.com/w40/my.png',
  th: 'https://flagcdn.com/w40/th.png',
  cn: 'https://flagcdn.com/w40/cn.png',
  kr: 'https://flagcdn.com/w40/kr.png',
  jp: 'https://flagcdn.com/w40/jp.png',
};

const KEYWORD_TO_CODE: Record<string, string> = {
  // Arab
  'مصر': 'eg',
  'egypt': 'eg',
  'السعودية': 'sa',
  'saudi': 'sa',
  'الإمارات': 'ae',
  'امارات': 'ae',
  'uae': 'ae',
  'قطر': 'qa',
  'qatar': 'qa',
  'الكويت': 'kw',
  'kuwait': 'kw',
  'العراق': 'iq',
  'iraq': 'iq',
  'لبنان': 'lb',
  'lebanon': 'lb',
  'الأردن': 'jo',
  'اردن': 'jo',
  'jordan': 'jo',
  'فلسطين': 'ps',
  'palestine': 'ps',
  'سوريا': 'sy',
  'syria': 'sy',
  'المغرب': 'ma',
  'morocco': 'ma',
  'الجزائر': 'dz',
  'algeria': 'dz',
  'تونس': 'tn',
  'tunisia': 'tn',
  'ليبيا': 'ly',
  'libya': 'ly',
  'السودان': 'sd',
  'sudan': 'sd',
  'اليمن': 'ye',
  'yemen': 'ye',
  'عمان': 'om',
  'oman': 'om',
  'البحرين': 'bh',
  'bahrain': 'bh',
  'موريتانيا': 'mr',
  'mauritania': 'mr',
  'جيبوتي': 'dj',
  'djibouti': 'dj',
  'جزر القمر': 'km',
  'comoros': 'km',
  'كردستان': 'kurdistan',
  'kurdistan': 'kurdistan',

  // World
  'تركيا': 'tr',
  'turkey': 'tr',
  'فرنسا': 'fr',
  'france': 'fr',
  'بريطانيا': 'gb',
  'united kingdom': 'gb',
  'ألمانيا': 'de',
  'germany': 'de',
  'إسبانيا': 'es',
  'spain': 'es',
  'إيطاليا': 'it',
  'italy': 'it',
  'البرتغال': 'pt',
  'portugal': 'pt',
  'هولندا': 'nl',
  'netherlands': 'nl',
  'بلجيكا': 'be',
  'belgium': 'be',
  'اليونان': 'gr',
  'greece': 'gr',
  'روسيا': 'ru',
  'russia': 'ru',
  'أمريكا': 'us',
  'usa': 'us',
  'united states': 'us',
  'كندا': 'ca',
  'canada': 'ca',
  'البرازيل': 'br',
  'brazil': 'br',
  'الأرجنتين': 'ar',
  'argentina': 'ar',
  'المكسيك': 'mx',
  'mexico': 'mx',
  'كولومبيا': 'co',
  'colombia': 'co',
  'تشيلي': 'cl',
  'chile': 'cl',
  'الهند': 'in',
  'india': 'in',
  'باكستان': 'pk',
  'pakistan': 'pk',
  'إيران': 'ir',
  'iran': 'ir',
  'بنغلاديش': 'bd',
  'bangladesh': 'bd',
  'إندونيسيا': 'id',
  'indonesia': 'id',
  'ماليزيا': 'my',
  'malaysia': 'my',
  'تايلاند': 'th',
  'thailand': 'th',
  'الصين': 'cn',
  'china': 'cn',
  'كوريا': 'kr',
  'korea': 'kr',
  'اليابان': 'jp',
  'japan': 'jp',
};

/**
 * Resolves a visual badge (Bouquet image or Country flag) for a category
 */
export function getCategoryVisual(name: string, remoteTopic?: string, icon?: string, flag?: string) {
  if (icon) return { type: 'icon' as const, src: icon };
  if (flag) return { type: 'flag' as const, src: flag };

  const lowerTopic = String(remoteTopic || '').toLowerCase();
  const lowerName = String(name || '').toLowerCase();

  // 1. Direct Bouquet Matches
  for (const [k, url] of Object.entries(BOUQUET_ICONS)) {
    if (lowerTopic.includes(k) || lowerName.includes(k)) {
      return { type: 'icon' as const, src: url };
    }
  }

  // 2. Direct Topic Key Matches (2-letter ISO)
  if (lowerTopic && COUNTRY_FLAG_MAP[lowerTopic]) {
    return { type: 'flag' as const, src: COUNTRY_FLAG_MAP[lowerTopic] };
  }

  // 3. Keyword Detection in Category Name
  for (const [kw, code] of Object.entries(KEYWORD_TO_CODE)) {
    if (lowerName.includes(kw)) {
      if (code === 'kurdistan') {
        return { type: 'icon' as const, src: BOUQUET_ICONS.kurdistan };
      }
      return { type: 'flag' as const, src: COUNTRY_FLAG_MAP[code] };
    }
  }

  // 4. Bracketed ISO codes, e.g. [EG], |SA|, (US)
  const isoMatch = name.match(/[\[|(|/]([A-Za-z]{2})[\]|)|/]/);
  if (isoMatch) {
    const code = isoMatch[1].toLowerCase();
    if (COUNTRY_FLAG_MAP[code]) {
      return { type: 'flag' as const, src: COUNTRY_FLAG_MAP[code] };
    }
  }

  return null;
}
