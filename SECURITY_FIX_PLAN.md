# 🛡️ خطة الإصلاح الأمني — ARN IPTV Pro v2.6.0

## 📋 جدول المحتوى

- [المرحلة 1: إصلاحات فورية (نفس الجلسة)](#مرحلة-1)
- [المرحلة 2: إصلاحات قصيرة (1-2 ساعة)](#مرحلة-2)
- [المرحلة 3: إصلاحات متوسطة (3-5 ساعات)](#مرحلة-3)
- [المرحلة 4: تحسينات بنية طويلة المدى](#مرحلة-4)
- [جدول أولويات تنفيذ سريع](#جدول-أولويات)

---

## المرحلة 1: إصلاحات فورية <a id="مرحلة-1"></a>

### 1.1 إضافة Security Headers بـ Helmet

**الملفات:** `server.ts`  
**الوقت المتوقع:** 15 دقيقة  
**الأثر:** يغطي 8 نقاط ضعف أمنية في خطوة واحدة

#### الخطوة الأولى: تثبيت الحزمة
```bash
npm install helmet cors --save
```

#### الخطوة الثانية: تعديل `server.ts`

أضف الـ imports في بداية الملف:
```typescript
import helmet from 'helmet';
import cors from 'cors';
```

ضع هذه الأسطر **بعد** تعريف `app` و **قبل** أي routes:
```typescript
// Security headers via Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", 'http://127.0.0.1:*'],
      scriptSrc: ["'self'", 'http://127.0.0.1:*'],
      styleSrc: ["'self'", "'unsafe-inline'", 'http://127.0.0.1:*'],
      imgSrc: ["'self'", 'http://127.0.0.1:*', 'data:', 'blob:', 
               'https://i.imgur.com', 'https://upload.wikimedia.org',
               'https://flagcdn.com'],
      mediaSrc: ["'self'", 'http://127.0.0.1:*', '*'],
      connectSrc: ["'self'", 'http://127.0.0.1:*', '*'],
      frameSrc: ["'none'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    }
  },
  xFrameOptions: { action: 'deny' },
  xContentTypeOptions: true,
  hsts: { maxAge: 31536000, includeSubDomains: false, preload: false },
}));

// CORS for trusted origins only
const ALLOWED_ORIGINS = ['http://127.0.0.1:3000', 'http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
```

**احذف أو عدّل كل سطر موجود فيه:** `res.setHeader('Access-Control-Allow-Origin', '*');`  
في الملفات: `server.ts:399,438,453,476,514` → استبدله بـ:
```typescript
// اسمح فقط للأصول الموثوقة
const reqOrigin = req.headers.origin;
if (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)) {
  res.setHeader('Access-Control-Allow-Origin', reqOrigin);
}
```

---

### 1.2 تعطيل Debug Endpoints في الإنتاج

**الملف:** `server.ts`

أحط الـ crypto-test endpoint داخل شرط:
```typescript
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/fg/crypto-test', async (req, res) => {
    // ... الكود الحالي
  });
}
```

اعمل نفس الشيء مع `/api/ping`:
```typescript
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/ping', (req, res) => {
    // ... الكود الحالي
  });
}
```

أو الأفضل: احذف `/api/fg/crypto-test` نهائياً لأنه يعرض مفاتيح التشفير.

---

### 1.3 تنظيف أخطاء Xtream Codes من بيانات حساسة

**الملف:** `server.ts`  
**الأسطر:** 567, 588, 827

**قبل:**
```typescript
res.status(401).json({ success: false, error: errorDetail, userInfo });
```

**بعد:**
```typescript
res.status(401).json({ 
  success: false, 
  error: 'بيانات الحساب غير صالحة أو الحساب غير نشط' 
});
```

**قبل (sync endpoint):**
```typescript
res.json({
  success: true,
  accountInfo: data.account_info,
  // ...
});
```

**بعد:**
```typescript
const acct = data?.account_info;
res.json({
  success: true,
  accountInfo: acct ? {
    status: acct.status,
    expDate: new Date(acct.expDate * 1000).toLocaleDateString('ar-EG'),
    isActive: acct.status === 'Active',
    isExpired: acct.status === 'Expired'
  } : null,
  streamsUrl: STREAMS_URL,
  liveStreamsUrl: LIVE_STREAMS_URL,
});
```

---

### 1.4 إزالة البيانات الحساسة من Console Warnings

**الملف:** `server.ts`  
**الأسطر:** 686, 745, 799

**قبل:**
```typescript
console.warn('[Xtream] Warning fetching live streams:', liveErr);
console.warn('[Xtream] Error in getLiveByRedirect:', err);
```

**بعد:**
```typescript
console.warn('[Xtream] Live stream fetch failed:', 
  liveErr instanceof Error ? liveErr.message : 'Unknown error');
```

---

## المرحلة 2: إصلاحات قصيرة <a id="مرحلة-2"></a>

### 2.1 إضافة Rate Limiting

**الملفات:** `server.ts`

تثبيت الحزمة:
```bash
npm install express-rate-limit --save
```

إضافة imports:
```typescript
import rateLimit from 'express-rate-limit';
```

إنشاء الـ limiters:
```typescript
// Rate limiter عام للـ API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Try again later.' },
});

// Rate limiter شديد للـ authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 10, // 10 محاولات كحد أقصى
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Many failed attempts. Please try again in 15 minutes.' },
});

// Rate limiter لـ M3U parsing (عمليته ثقيلة)
const m3uLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // ساعة كاملة
  max: 5, // 5 عمليات parse كحد أقصى بالساعة
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'M3U parsing rate limited. Try again later.' },
});
```

تطبيقها على الـ endpoints:
```typescript
// Authentication - شديد الحماية
app.post('/api/xtream/authenticate', authLimiter, async (req, res) => {
  // ... الكود الحالي
});

app.post('/api/fg/activate', authLimiter, async (req, res) => {
  // ... الكود الحالي
});

// Sync operations - متوسط الحماية
app.post('/api/xtream/sync', apiLimiter, async (req, res) => {
  // ... الكود الحالي
});

app.post('/api/m3u/parse', m3uLimiter, async (req, res) => {
  // ... الكود الحالي
});
```

---

### 2.2 إصلاح SSRF في M3U Parser

**الملف:** `server.ts`

إضافة import للـ IP validation:
```bash
npm install ipaddr.js --save
```

```typescript
import * as ipaddr from 'ipaddr.js';
```

كتابة دالة حماية SSRF الجديدة:
```typescript
function isValidAndSafeUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    
    // السماح فقط بـ http و https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    
    const hostname = parsed.hostname.toLowerCase();
    
    // منع localhost و loopback
    if (hostname === 'localhost' || 
        hostname.startsWith('127.') || 
        hostname === '::1' ||
        hostname === '[::]') {
      return false;
    }
    
    // منع النطاقات الداخلية
    if (hostname.endsWith('.internal') || 
        hostname.endsWith('.local') ||
        hostname.endsWith('.localdomain')) {
      return false;
    }
    
    // التحقق من IPs باستخدام ipaddr.js
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      try {
        const addr = ipaddr.parse(hostname);
        // حظر كل النطاقات الخاصة والمحجوزة
        if (addr.range() !== 'unicast') {
          return false;
        }
      } catch {
        return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
}
```

استبدال Fetch في `/api/m3u/parse`:
```typescript
app.post('/api/m3u/parse', async (req, res) => {
  const { url } = req.body;
  
  // ✅ تحقق من الأمان قبل أيfetch
  if (!url || !isValidAndSafeUrl(url)) {
    return res.status(400).json({ 
      success: false, 
      error: 'URL غير صالح أو غير آمن' 
    });
  }
  
  try {
    const resp = await axios.get(String(url), { timeout: 12000, responseType: 'text' });
    // ... باقي الكود
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'فشل جلب محتوى playlist. تأكد من صحة الرابط.'
    });
  }
});
```

تطبيق نفس الدالة على `/api/xtream/sync`:
```typescript
app.post('/api/xtream/sync', async (req, res) => {
  const { host, username, password } = req.body;
  
  const apiUrl = `http://${host}:${port}/player_api.php?username=${username}&password=${password}`;
  
  if (!isValidAndSafeUrl(apiUrl)) {
    return res.status(400).json({ success: false, error: 'Host غير صالح أو غير آمن' });
  }
  // ... باقي الكود
});
```

---

### 2.3 تطبيق SSRF Protection على Stream Proxy

**الملف:** `server.ts`  

دالة الحماية الحالية ضعيفة. عدّلها من:
```typescript
function isValidStreamUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname.includes('169.254.169.254') || 
        hostname.includes('.internal') || 
        hostname.includes('.local')) {
      return false;
    }
    return true;
  } catch { return false; }
}
```

إلى:
```typescript
function isValidStreamUrl(urlStr: string): boolean {
  return isValidAndSafeUrl(urlStr); // استخدم نفس الدالة القوية من 2.2
}
```

---

## المرحلة 3: إصلاحات متوسطة <a id="مرحلة-3"></a>

### 3.1 نقل مفاتيح التشفير لمتغيرات البيئة

**الملفات:** `src/server/fgEngine.ts`, `.env.example`

تعديل `fgEngine.ts`:
```typescript
// ❌ قبل (مفاتيح مكشوفة)
const DRAMA_KEY = Buffer.from('0123456789abcdef', 'utf8');
const DRAMA_IV = Buffer.from('fedcba9876543210', 'utf8');

// ✅ بعد (من بيئة)
const DRAMA_KEY = Buffer.from(
  process.env.FG_AES_KEY || '0123456789abcdef', 'utf8'
);
const DRAMA_IV = Buffer.from(
  process.env.FG_AES_IV || 'fedcba9876543210', 'utf8'
);
```

تحديث `.env.example`:
```env
# Crypto Keys - Change these in production!
FG_AES_KEY="0123456789abcdef"
FG_AES_IV="fedcba9876543210"

# Server Binding Address (keep 127.0.0.1 unless you know what you're doing!)
BIND_ADDRESS="127.0.0.1"

GEMINI_API_KEY=""
APP_URL="http://127.0.0.1:3000"
```

**تحذير مهم:** تحديث أيضًا `electronTemplates.ts:117` حيث تظهر المفاتيح بنفس الطريقة.

---

### 3.2 إضافة LRU Cache لتجنب Memory Leak

**الملف:** `server.ts`

تثبيت المكتبة:
```bash
npm install node-cache --save
```

استبدال Map العادي:
```typescript
// ❌ قبل (ينمو بلا حدود)
const streamCache = new Map<string, ResolvedFgStream>();

// ✅ بعد (TTL + Max Size)
import NodeCache from 'node-cache';
const streamCache = new NodeCache({ 
  stdTTL: 300,       // 5 دقائق TTL
  checkperiod: 60,   // فحص كل دقيقة
  maxKeys: 2000      // حد أقصى 2000 عنصر
});
```

تحديث استخدام الـ cache:
```typescript
// Get
const cached = streamCache.get(cacheKey);
if (cached) return cached;

// Set
streamCache.set(cacheKey, info);
streamCache.set(idLive, info);
```

---

### 3.3 Device ID ديناميكي

**الملف:** `src/server/fgEngine.ts`

```typescript
// ❌ قبل (ثابت لكل المستخدمين)
device_id: 'arn_iptv_dev_9921',

// ✅ بعد (ديناميكي فريد لكل جلسة)
user_id: `_23351_${Date.now()}_${Math.random().toString(36).slice(2,10)}.com_dramalive3`,
device_id: `arn_iptv_${crypto.randomUUID().slice(0,8)}`,
```

إذا كنت تريد Device ID ثابت لكل جهاز، استخدم localStorage:
```typescript
const storedDeviceId = localStorage.getItem('arn_iptv_device_id');
if (storedDeviceId) {
  device_id: storedDeviceId;
} else {
  const newId = `arn_iptv_${crypto.randomUUID()}`;
  localStorage.setItem('arn_iptv_device_id', newId);
  device_id: newId;
}
```

---

### 3.4 تصحيح Electron External URL Handler

**الملف:** `electron-main.cjs`

```typescript
// ❌ قبل (يسمح بأي رابط http/https)
setWindowOpenHandler(({ url }) => {
  if (url.startsWith('http:') || url.startsWith('https:')) {
    shell.openExternal(url);
    return { action: 'deny' };
  }
  return { action: 'allow' };
});

// ✅ بعد (Allowlist محدود)
setWindowOpenHandler(({ url }) => {
  const ALLOWED_DOMAINS = [
    'wa.me', 'telegram.me', 't.me',
    'facebook.com', 'm.me',
    'twitter.com', 'x.com',
    'youtube.com', 'youtu.be',
    'instagram.com'
  ];
  
  let targetUrl: string;
  try { targetUrl = new URL(url).href; } catch { return { action: 'deny' }; }
  
  if (targetUrl.startsWith('http:') || targetUrl.startsWith('https:')) {
    const parsed = new URL(targetUrl);
    const isAllowed = ALLOWED_DOMAINS.some(d => 
      parsed.hostname.endsWith(d) || d.includes(parsed.hostname)
    );
    
    if (isAllowed) {
      shell.openExternal(targetUrl);
      return { action: 'deny' };
    }
  }
  
  return { action: 'deny' };
});
```

---

### 3.5 إضافة Integirty Check للـ LocalStorage

**الملف:** `src/App.tsx`

```typescript
// ❌ قبل (فشل صامت)
return saved ? JSON.parse(saved) : [];

// ✅ بعد (validation + fallback)
function loadPlaylistData(key: string): PlaylistSource[] {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return [];
    
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    
    // Validate each item has required fields
    return parsed.filter((pl: PlaylistSource) => 
      pl.id != null && pl.name != null && pl.type != null
    );
  } catch (err) {
    console.error(`Corrupted data in ${key}, resetting...`, err);
    localStorage.removeItem(key); // Clean corrupted data
    return [];
  }
}
```

طبق نفس الفكرة على `loadFavorites`, `loadWatchHistory`, `loadCustomChannels`.

---

### 3.6 حماية تحميل ملفات M3U

**الملف:** `src/components/PlaylistModal.tsx`

```typescript
// إضافة تأكيد في reader.onload:
reader.onload = () => {
  if (typeof reader.result === 'string') {
    // تحقق من ترويسة M3U
    if (!reader.result.trim().startsWith('#EXTM3U')) {
      setErrMsg('❌ الملف لا يحتوي على ترويسة M3U صحيحة');
      setM3uRawText('');
      return;
    }
    
    // تحديد حجم ملف منطقي (< 5MB)
    if (reader.result.length > 5 * 1024 * 1024) {
      setErrMsg('⚠️ حجم الملف كبير جداً (أكبر من 5MB)');
      return;
    }
    
    setM3uRawText(reader.result);
    setIsParsed(true);
    setErrMsg('✅ تم تحليل الملف بنجاح');
  }
};
```

إضافة size limit على file input:
```html
<input 
  type="file" 
  accept=".m3u,.m3u8"
  onChange={handleFileChange}
  title="اختر ملف.playlist بصيغة .m3u أو .m3u8 فقط"
/>
```

**ملاحظة:** احذف `.txt` من الـ `accept` attribute.

---

## المرحلة 4: تحسينات البنية طويلة المدى <a id="مرحلة-4"></a>

### 4.1 فصل Configuration عن Source Code

أنشئ ملف `config/security.ts`:
```typescript
export const SECURITY_CONFIG = {
  STREAM_PROXY_TIMEOUT: 15000,
  MAX_M3U_FILE_SIZE_MB: 5,
  CACHE_TTL_SECONDS: 300,
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
  AUTH_MAX_ATTEMPTS: 10,
  ALLOWED_PROXY_HOSTS: process.env.ALLOWED_PROXY_HOSTS?.split(',') || [],
};
```

ثم استبدل كل الـ hardcoded values بـ `SECURITY_CONFIG.*`.

---

### 4.2 إضافة Request Origin Verification

**الملف:** `server.ts`

```typescript
// إنشاء App Secret مخزن في Environment
const APP_SECRET = process.env.APP_SECRET || crypto.randomUUID();

// Middleware للتأكد أن الطلبات جاية من التطبيق نفسه
function verifyAppToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-app-token'] as string;
  const publicPaths = ['/api/catalog/', '/api/ping'];
  
  if (publicPaths.some(p => req.path.startsWith(p))) {
    return next();
  }
  
  if (!token || token !== APP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

app.use(verifyAppToken);
```

في Electron `electron-main.cjs`، أضف الـ token:
```javascript
mainWindow.loadURL(`http://127.0.0.1:${port}/`);

// Send token to renderer via IPC
ipcMain.on('init-app-token', (event) => {
  event.reply('app-token', process.env.APP_SECRET || 'fallback-secret');
});
```

في `preload.cjs`:
```javascript
exposeInMainWorld('appToken', process.env.APP_SECRET);
```

---

### 4.3 Systemd/Process Guard للسيرفر

إذا كنت شغال على Linux/macOS مستقبلاً، أنشئ service file يحافظ على السيرفر حي:

```ini
# /etc/systemd/system/arn-iptv.service
[Unit]
Description=ARN IPTV Pro Server
After=network.target

[Service]
Type=simple
User=arn
WorkingDirectory=/opt/arn-iptv
ExecStart=/usr/bin/node server.cjs
Restart=always
RestartSec=3
Environment="NODE_ENV=production"
Environment="BIND_ADDRESS=127.0.0.1"

[Install]
WantedBy=multi-user.target
```

---

## جدول الأولويات السريعة <a id="جدول-أولويات"></a>

| # | الإجراء | الملف | الوقت | الخطورة | الحالة |
|---|---------|-------|-------|---------|--------|
| 1 | إضافة helmet + cors مخصصة للـ IPTV | `server.ts` | 15 دقيقة | HIGH ✅ | ✅ مُنفّذ |
| 2 | تعطيل وحماية crypto-test endpoint في الإنتاج | `server.ts` | 5 دقائق | CRITICAL ✅ | ✅ مُنفّذ |
| 3 | تنظيف أخطاء Xtream من كشف البيانات الحساسة | `server.ts` | 20 دقيقة | HIGH ✅ | ✅ مُنفّذ |
| 4 | إزالة sensitive data والروابط السرية من console.warn | `server.ts` | 10 دقائق | MEDIUM ✅ | ✅ مُنفّذ |
| 5 | تثبيت وتفعيل Rate Limiting للـ Auth و M3U | `server.ts` | 30 دقيقة | HIGH | ✅ مُنفّذ |
| 6 | بناء SSRF protection قوي وحظر Cloud Metadata | `server.ts` | 1 ساعة | CRITICAL | ✅ مُنفّذ |
| 7 | تطبيق فحص SSRF على M3U Parse و Xtream | `server.ts` | 15 دقيقة | CRITICAL | ✅ مُنفّذ |
| 8 | عزل وتأمين مفاتيح البروتوكول ومنع تصديرها | `fgEngine.ts` | 10 دقائق | CRITICAL | ✅ مُنفّذ |
| 9 | تحديث قوالب الإكسبورت | `electronTemplates.ts` | 10 دقائق | CRITICAL | ✅ مُنفّذ |
| 10 | إضافة NodeCache لحماية الذاكرة من التسريب | `server.ts` | 30 دقيقة | HIGH | ✅ مُنفّذ |
| 11 | Device ID ديناميكي | `fgEngine.ts` | 15 دقيقة | MEDIUM | ✅ مُنفّذ |
| 12 | تصحيح Electron URL handler بقائمة نطاقات موثوقة | `electron-main.cjs` | 30 دقيقة | HIGH | ✅ مُنفّذ |
| 13 | integrity check للـ LocalStorage ومنع انهيار الواجهة | `src/App.tsx` | 30 دقيقة | HIGH | ✅ مُنفّذ |
| 14 | حماية M3U file upload بحدود الحجم وفحص الترويسة | `PlaylistModal.tsx` | 20 دقيقة | MEDIUM | ✅ مُنفّذ |

---

## ✅ Checklist ما بعد التنفيذ

بعد تنفيذ كل مرحلة:

- [x] شغّل `npm run build` وتأكد أن البناء بيشتغل صح
- [x] تأكد أن الـ headers الأمنية موجودة باستجابة: `Helmet (X-Frame-Options: DENY, CSP, nosniff)`
- [x] اختبر SSRF: حاول إرسال طلب لـ `http://169.254.169.254/latest/meta-data/` عبر M3U parser — تم منعه بنجاح (Status 400)
- [x] تأكد أن `/api/fg/crypto-test` راجع 404 في وضع الإنتاج
- [x] اختبر Rate Limiting: مفعل بنجاح على نقاط المصادقة وتفعيل الأكواد وتحليل القوائم
- [x] تأكد أن localStorage data بتُحمى من تلف بالـ integrity check (`Array.isArray`)
- [x] حماية النوافذ الخارجية في Electron عبر الـ Allowlist للمواقع الموثوقة
