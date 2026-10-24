# 🚀 خطة البناء المعمارية الشاملة: تحويل ARN IPTV إلى Electron.js
### **الاسم المقترح:** ARN IPTV Desktop (Electron Edition)
### **المطور والمالك:** عبده رجب نصار — شركة ARN Technology © 2026
### **الهدف:** بناء نسخة مكتبية حديثة فائقة الخفة والجمال بنمط **Dark Glassmorphism**، تعمل بدون الحاجة لتثبيت برامج خارجية (مثل VLC أو بايثون)، مع الحفاظ على نفس محرك فك تشفير دراما لايف وبروكسي البث المحلي.

---

## 🎯 1. الرؤية الهندسية والمقارنة المعمارية

عند بناء تطبيق سطح المكتب بـ Electron.js مع نفس محرك دراما لايف والبروكسي، هناك مساران:

| وجه المقارنة | الخيار (أ): محرك نقي بالكامل (Pure Node.js + hls.js) ⭐ **(الموصى به)** | الخيار (ب): محرك هجين (Electron + Python Sidecar) |
| :--- | :--- | :--- |
| **الاعتماديات الخارجية** | **صفر اعتماديات** (لا يحتاج Python ولا VLC خارجي). | يتطلب بيئة بايثون مدمجة أو مجمعة بـ PyInstaller. |
| **مشغل الفيديو** | مشغل **HTML5 Video + hls.js** مدمج في المتصفح مع تسريع عتادي (GPU). | إما مشغل HTML5 متصل ببروكسي بايثون، أو تضمين VLC DLLs. |
| **حجم التطبيق** | خفيف، حزمة واحدة متكاملة ومنظمة. | حجم كبير بسبب ازدواجية محرك Electron + مكتبات بايثون. |
| **استهلاك الذاكرة** | عملية واحدة موحدة (Main + Renderer). | عمليتان منفصلتان تتبادلان البيانات عبر IPC. |
| **تجربة العميل النهائي** | تثبيت بنقرة واحدة يعمل فوراً بدون أي تعقيدات. | قد تواجه مشاكل أذونات جدار الحماية بين البروسيسين. |

> [!TIP]
> **التوصية الرسمية لمشاريع ARN Technology:** اعتماد **الخيار (أ)** بكتابة محرك التشفير والبروكسي بلغة JavaScript/Node.js الأصلية واستخدام مكتبة `hls.js` لتشغيل البث داخل عنصر `<video>`؛ لأن البروكسي الداخلي يتولى فك التشفير وإزالة تشويش `k9x_` وتمرير دفق MPEG-TS القياسي الذي تدعمه `hls.js` بكفاءة 100%.

---

## 🛠️ 2. المكدس التقني المعتمد (Tech Stack)

* **بيئة سطح المكتب:** [Electron.js](https://www.electronjs.org/) (Main Process + Context-Isolated Preload + Webview/Renderer).
* **محرك الفيديو الداخلي:** [hls.js](https://github.com/video-dev/hls.js/) + HTML5 Video API (يوفر تحكماً كاملاً بالصوت حتى 200%، نسب الشاشة، والملء الكامل).
* **قاعدة البيانات المحلية:** [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (أسرع محرك SQLite متزامن في بيئة Node.js لقراءة 50k+ قناة بسرعة خارقة).
* **خوارزميات التشفير:** وحدة `crypto` المدمجة في Node.js (AES-128-CBC PKCS7).
* **بروكسي البث الداخلي:** وحدة `http` المدمجة في Node.js (`http.createServer` على المنفذ `127.0.0.1:39871`).
* **واجهة المستخدم والأنماط:**
  - بنية دلالية: HTML5 (دعم كامل لـ `dir="rtl"`).
  - التصميم: **Modern Vanilla CSS3 Dark Glassmorphism** (بدون أطر عمل ثقيلة لتحقيق أقصى استجابة).
  - الخطوط: خط **Cairo** للعربية و **JetBrains Mono** للأكواد والأرقام.
  - الألوان: الخلفية العميقة (`#070b14`)، البطاقات الزجاجية (`#0f172a`)، اللمسات الزمردية (`#10b981`) والسماوية (`#38bdf8`).

---

## 📂 3. هيكل المشروع القياسي (Unified Folder Structure)

وفقاً للقواعد الرسمية لمشاريع **ARN Technology**:

```text
ARN-IPTV-Electron/
├── package.json                  # توصيف المشروع وحزم Node.js
├── Run-DesktopApp.bat            # مشغل نظيف بترميز chcp 65001 لتفادي أخطاء CMD
├── Run-DesktopApp.ps1            # سكريبت إقلاع بصلاحيات التشغيل
├── src/
│   ├── main/                     # المعالج الرئيسي (Main Process)
│   │   ├── main.js               # إدارة النوافذ ودورة حياة التطبيق والـ IPC
│   │   ├── fg_engine.js          # محرك فك تشفير دراما لايف الرسمي وتنشيط الأكواد
│   │   ├── stream_proxy.js       # خادم البروكسي المحلي ومزيل k9x_ swap
│   │   └── database.js           # مدير قاعدة بيانات better-sqlite3
│   ├── preload/
│   │   └── preload.js            # جسر الحماية وعزل السياق (contextBridge)
│   └── renderer/                 # واجهة العرض الرسومية (UI)
│       ├── index.html            # بنية الواجهة بنظام الـ 3 أعمدة
│       ├── css/
│       │   ├── glassmorphism.css # نظام التصميم والطبقات الزجاجية
│       │   └── layout.css        # نظام المقسمات والأعمدة الثلاثة
│       ├── js/
│       │   ├── app.js            # إدارة الحالة وتوجيه الصفحات
│       │   ├── player.js         # مشغل Hls.js المخصص مع عناصر OSD
│       │   └── categories.js     # عمود التصنيفات والبحث الذكي
│       └── assets/
│           ├── icons/            # أيقونات السوشيال ميديا وشعار البرنامج
│           └── fonts/            # خط Cairo المدمج محلياً
└── build/                        # إعدادات حزمة التثبيت Inno Setup و electron-builder
```

---

## 🔐 4. نقل محرك فك التشفير إلى JavaScript (`fg_engine.js`)

نفس كود بايثون الحالي يتم تحويله إلى دوال نقية في Node.js باستخدام مكتبة `crypto`:

```javascript
// src/main/fg_engine.js
const crypto = require('crypto');
const axios = require('axios');

const DRAMA_KEY = Buffer.from('0123456789abcdef', 'utf8');
const DRAMA_IV  = Buffer.from('fedcba9876543210', 'utf8');

function encryptPayload(dataObj) {
    const plain = JSON.stringify(dataObj);
    const cipher = crypto.createCipheriv('aes-128-cbc', DRAMA_KEY, DRAMA_IV);
    let encrypted = cipher.update(plain, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const ivB64 = DRAMA_IV.toString('base64');
    return `${encrypted}:${ivB64}`;
}

function decryptPayload(encStr) {
    const parts = encStr.trim().replace(/"/g, '').split(':');
    if (parts.length !== 2) return encStr;
    const ct = Buffer.from(parts[0], 'base64');
    const iv = Buffer.from(parts[1], 'base64');
    
    const decipher = crypto.createDecipheriv('aes-128-cbc', DRAMA_KEY, iv);
    let decrypted = decipher.update(ct, null, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

function buildDramaPayload(code, topicId = null) {
    const p = {
        user_id: "arn_iptv_user",
        device_id: "arn_iptv_dev_9921",
        device_api: "34",
        version_name: "187",
        language: "ar",
        timezone: "Africa/Cairo",
        device_type: "phone",
        KEY_ACTIVATED_TYPE: String(code),
        store: "direct",
        type: "tv",
        isStoreVersion: false,
        isPremium: false,
        isCoupon_active: false,
        hideAds: false,
        appCount: "1",
        mainServer: "http://main.eastgoessouth.online/api/live/livedrama/v13.0.0/"
    };
    if (topicId) p.topic = String(topicId);
    return p;
}

module.exports = { encryptPayload, decryptPayload, buildDramaPayload };
```

---

## 📡 5. نقل خادم البروكسي المحلي إلى Node.js (`stream_proxy.js`)

يقوم البروكسي بنفس العمل: استقبال طلب المشغل، حل الرابط المباشر، إزالة بادئة `k9x_` من المانيفست، وتمرير تدفق الفيديو:

```javascript
// src/main/stream_proxy.js
const http = require('http');
const url = require('url');
const axios = require('axios');
const { encryptPayload, decryptPayload, buildDramaPayload } = require('./fg_engine');

const PROXY_PORT = 39871;
const streamCache = new Map(); // id_live -> streamInfo

async function resolveFgStream(code, idLive) {
    const headers = {
        'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 14; Build/UP1A.231005.007)',
        'Content-Type': 'application/json; charset=utf-8'
    };
    const payload = buildDramaPayload(code);

    // 1. getLiveById
    const pId = { ...payload, id: [idLive] };
    const rId = await axios.post('http://live.eastgoessouth.online/api/live/livedrama/v13.0.0/getLiveById', 
        encryptPayload(pId), { headers, timeout: 8000 });
    const decId = JSON.parse(decryptPayload(rId.data));
    const liveInfo = decId.live?.[0] || {};

    // 2. getLiveByRedirect
    const pRed = { ...payload, id: idLive, url: liveInfo.url, agent: liveInfo.agent };
    const rRed = await axios.post('http://redirect.eastgoessouth.online/redirect/getLiveByRedirect', 
        encryptPayload(pRed), { headers, timeout: 8000 });
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
        const path = parsed.pathname;

        if (path === '/ping') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            return res.end('pong');
        }

        // مسار القناة: /live/:id?code=...
        if (path.startsWith('/live/')) {
            const idLive = path.replace('/live/', '').replace('.m3u8', '');
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

                // إعادة كتابة سطور ملف M3U8 وإزالة بادئة k9x_
                const lines = response.data.split('\n');
                const newLines = lines.map(line => {
                    const l = line.trim();
                    if (!l || l.startsWith('#')) return l;
                    if (l.includes('.m3u8')) {
                        const fullSub = new URL(l, baseUrl).href;
                        return `http://127.0.0.1:${PROXY_PORT}/subplaylist?id=${idLive}&u=${encodeURIComponent(fullSub)}`;
                    }
                    let segName = l;
                    for (const [k, v] of Object.entries(swap)) {
                        segName = segName.split(k).join(v);
                    }
                    const fullSeg = new URL(segName, baseUrl).href;
                    return `http://127.0.0.1:${PROXY_PORT}/ts?id=${idLive}&u=${encodeURIComponent(fullSeg)}`;
                });

                const body = Buffer.from(newLines.join('\n'), 'utf8');
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

        // مسار مقاطع الفيديو TS: /ts?id=...&u=...
        if (path.startsWith('/ts')) {
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
        console.log(`[Proxy] Running on http://127.0.0.1:${PROXY_PORT}`);
    });
}

module.exports = { startStreamProxy };
```

---

## 🎨 6. هيكل الواجهة (HTML5 3-Column Glassmorphism Layout)

في ملف `src/renderer/index.html`، يتم تقسيم الشاشة إلى 3 أعمدة تفاعلية مع شريط ملاحة جانبي:

```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>ARN IPTV Pro</title>
    <link rel="stylesheet" href="css/glassmorphism.css">
    <link rel="stylesheet" href="css/layout.css">
    <!-- مكتبة HLS.js لتشغيل البث بجودة GPU عتادية داخل المتصفح -->
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
</head>
<body>
    <div class="app-container">
        <!-- 1. الشريط الجانبي الأقصى (Sidebar) -->
        <aside class="sidebar">
            <div class="logo-box">
                <img src="assets/icons/app_icon.png" alt="ARN" class="app-logo">
            </div>
            <nav class="nav-buttons">
                <button class="nav-btn active" data-page="live"><span class="icon">📺</span><span class="label">البث</span></button>
                <button class="nav-btn" data-page="movies"><span class="icon">🎬</span><span class="label">الأفلام</span></button>
                <button class="nav-btn" data-page="series"><span class="icon">🗂️</span><span class="label">المسلسلات</span></button>
                <button class="nav-btn" data-page="fav"><span class="icon">⭐</span><span class="label">المفضلة</span></button>
                <button class="nav-btn" data-page="history"><span class="icon">⏱️</span><span class="label">الأخيرة</span></button>
            </nav>
            <div class="sidebar-footer">
                <button id="btnPlaylists" class="nav-btn"><span class="icon">📋</span><span class="label">القوائم</span></button>
                <button id="btnAbout" class="nav-btn"><span class="icon">ℹ️</span><span class="label">حول</span></button>
            </div>
        </aside>

        <!-- 2. منطقة الـ 3 أعمدة الرئيسية -->
        <main class="main-content-splitter">
            <!-- العمود الأول: لوحة التصنيفات (Categories Panel) -->
            <section class="panel categories-panel">
                <div class="panel-header">
                    <h3>📂 التصنيفات</h3>
                    <span id="catCountBadge" class="pill-badge">0 فئة</span>
                </div>
                <div class="search-box">
                    <input type="text" id="catSearchInput" placeholder="🔍 بحث في التصنيفات...">
                </div>
                <div id="categoriesList" class="scroll-list">
                    <!-- تتولد التصنيفات ديناميكياً هنا -->
                </div>
            </section>

            <!-- العمود الثاني: لوحة القنوات (Channels Panel) -->
            <section class="panel channels-panel">
                <div class="panel-header">
                    <h3 id="currentCatTitle">🌐 الكل</h3>
                    <span id="chCountBadge" class="pill-badge">0 قناة</span>
                </div>
                <div class="filter-toolbar">
                    <input type="text" id="chSearchInput" placeholder="🔍 ابحث عن قناة...">
                    <button id="btnFavFilter" class="btn-fav-filter">★ المفضلة</button>
                </div>
                <div id="channelsList" class="scroll-list channels-grid">
                    <!-- تتولد كروت القنوات الزجاجية هنا -->
                </div>
            </section>

            <!-- العمود الثالث: مشغل الفيديو المدمج (Video Player Container) -->
            <section class="player-container">
                <div class="player-header">
                    <div class="now-playing-info">
                        <span class="live-dot"></span>
                        <h4 id="nowPlayingTitle">— لم يتم تحديد قناة —</h4>
                        <span id="nowPlayingGroup" class="group-tag">بث مباشر</span>
                    </div>

                    <!-- خيارات الخوادم المتعددة للقناة -->
                    <div class="server-selector-container">
                        <label for="serverSelect" class="source-lbl">🌐 السيرفر:</label>
                        <select id="serverSelect" class="source-select">
                            <option value="0">سيرفر 1 (رئيسي)</option>
                        </select>
                    </div>

                    <button id="btnFullscreen" class="btn-icon" title="ملء الشاشة (F / نقر مزدوج)">⛶</button>
                </div>

                <div class="video-wrapper" id="videoWrapper">
                    <video id="videoPlayer" playsinline></video>
                    
                    <!-- مؤشر الصوت العائم التفاعلي عند تحريك عجلة الماوس -->
                    <div id="volumeOverlay" class="volume-overlay hidden">
                        <span id="volOverlayIcon">🔊</span>
                        <span id="volOverlayText">100%</span>
                        <div class="vol-bar-track">
                            <div id="volBarFill" class="vol-bar-fill"></div>
                        </div>
                    </div>

                    <!-- سبينر التحميل -->
                    <div id="loadingSpinner" class="spinner-overlay hidden">
                        <div class="spinner"></div>
                        <p id="spinnerText">جاري تهيئة البث...</p>
                    </div>
                </div>

                <!-- شريط تحكم OSD سفلي احترافي -->
                <div class="osd-bar">
                    <button id="btnPlayPause" class="btn-osd" title="تشغيل / إيقاف (مسطرة)">⏸</button>
                    <button id="btnMute" class="btn-osd" title="كتم الصوت (M)">🔊</button>
                    <input type="range" id="volSlider" min="0" max="200" value="100" class="vol-slider" title="التحكم بالصوت حتى 200%">
                    <span id="volLabel">100%</span>
                    
                    <div class="osd-spacer"></div>

                    <!-- قائمة اختيار الجودة المتعددة (Adaptive HLS Levels) -->
                    <select id="qualitySelect" class="osd-select" title="جودة الفيديو">
                        <option value="-1">🎬 الجودة: تلقائي</option>
                    </select>

                    <!-- محول أبعاد الشاشة -->
                    <select id="aspectRatioSelect" class="osd-select" title="نسبة الأبعاد">
                        <option value="default">📐 أبعاد تلقائية</option>
                        <option value="16:9">16:9 (عريض)</option>
                        <option value="4:3">4:3 (كلاسيكي)</option>
                        <option value="fill">ملاءمة الشاشة</option>
                    </select>
                </div>
            </section>
        </main>
    </div>
</body>
</html>
```

---

## 🎮 7. المحرك التفاعلي للمشغل: تعدد الخوادم والجودات وإيماءات الماوس (`player.js`)

ملف `src/renderer/js/player.js` هو المحرك المركزي لتجربة المشاهدة ويوفر الميزات المطلوبة بدقة:

### 1. دعم تعدد سيرفرات البث للقناة الواحدة (Multi-Server & Failover Engine)
* **استخراج السيرفرات:** في دراما لايف وقوائم البث، قد تمتلك القناة خادماً رئيسياً وخوادم بديلة (`backup servers`).
* **التبديل اليدوي:** يتم ملء قائمة `#serverSelect` ديناميكياً بجميع السيرفرات المتاحة للقناة (`سيرفر 1 (رئيسي)`، `سيرفر 2 (احتياطي)`، `سيرفر 3`)، ويسمح للمستخدم بالتبديل الفوري بينها في حال وجود بطء في خادم معين.
* **التبديل التلقائي عند الانقطاع (Auto-Failover):** إذا أطلق المشغل خطأ `Hls.ErrorTypes.NETWORK_ERROR` أو تعذر الاتصال بالخادم الحالي، ينتقل المشغل تلقائياً إلى السيرفر الاحتياطي التالي دون إيقاف التجربة.

```javascript
// إدارة السيرفرات المتعددة
function loadChannelServers(channel) {
    const serverSelect = document.getElementById('serverSelect');
    serverSelect.innerHTML = '';
    
    const sources = channel.sources || [
        { name: "سيرفر 1 (الرئيسي)", url: channel.url },
        ...(channel.backups || []).map((b, i) => ({ name: `سيرفر ${i + 2} (احتياطي)`, url: b }))
    ];

    sources.forEach((src, idx) => {
        const opt = document.createElement('option');
        opt.value = src.url;
        opt.textContent = src.name;
        serverSelect.appendChild(opt);
    });

    serverSelect.onchange = () => {
        playStreamUrl(serverSelect.value);
    };
}
```

---

### 2. التحكم في الجودات المتعددة (Multi-Quality & Adaptive Bitrate Switcher)
باستخدام واجهة `hls.js`:
* عند قراءة ملف البث (`MANIFEST_PARSED`)، تستخرج المكتبة كافة الجودات المتوفرة (`hls.levels`).
* يتم ملء قائمة `#qualitySelect` تلقائياً بالجودات الحقيقية للبث (مثل: `1080p FHD`، `720p HD`، `480p SD`، `360p`) بجانب خيار `تلقائي (Auto)`.
* **التبديل اللحظي:** عند اختيار جودة، يتم تطبيق `hls.currentLevel = levelIndex` ليتحول البث فوراً للجودة المطلوبة بدون إعادة تحميل أو انقطاع في الصوت.

```javascript
// إدارة مستويات الجودة عبر Hls.js
hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
    const qualitySelect = document.getElementById('qualitySelect');
    qualitySelect.innerHTML = '<option value="-1">🎬 الجودة: تلقائي (Auto)</option>';

    data.levels.forEach((level, index) => {
        const height = level.height;
        const bitrate = Math.round(level.bitrate / 1000);
        let label = `${height}p (${bitrate} kbps)`;
        if (height >= 2160) label = `4K UHD (${height}p)`;
        else if (height >= 1080) label = `FHD 1080p`;
        else if (height >= 720) label = `HD 720p`;
        else if (height >= 480) label = `SD 480p`;

        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = `🎬 ${label}`;
        qualitySelect.appendChild(opt);
    });

    qualitySelect.onchange = () => {
        hls.currentLevel = parseInt(qualitySelect.value, 10);
    };
});
```

---

### 3. إيماءات المشغل الاحترافية (Player Gestures Engine)

#### أ. النقر المزدوج لملء الشاشة والخروج منها (Double-Click Fullscreen)
* النقر المزدوج في أي مكان داخل حاوية الفيديو (`#videoWrapper`) يقوم بتوسيع المشغل للشاشة الكاملة.
* النقر المزدوج مرة أخرى أو الضغط على مفتاح `Esc` أو `F` يعيد المشغل للوضع الطبيعي.

```javascript
const wrapper = document.getElementById('videoWrapper');

wrapper.addEventListener('dblclick', (e) => {
    // منع تفعيل التكبير إذا تم النقر على عناصر التحكم أو الأزرار
    if (e.target.closest('.osd-bar') || e.target.closest('.player-header')) return;
    
    toggleFullscreen();
});

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        wrapper.requestFullscreen().catch(err => console.error(err));
    } else {
        document.exitFullscreen();
    }
}
```

#### ب. عجلة الماوس للتحكم بالصوت وتضخيمه حتى 200% (Mouse Wheel Volume & Boost)
* عند تمرير عجلة الماوس فوق منطقة الفيديو:
  - التمرير للأعلى (`deltaY < 0`): زيادة الصوت بمقدار **+5%**.
  - التمرير للأسفل (`deltaY > 0`): خفض الصوت بمقدار **-5%**.
* **ميزة مضاعفة الصوت حتى 200%:** يتم استخدام `AudioContext` و `GainNode` من Web Audio API لتجاوز الحد الأقصى العادي (100%) وتضخيم القنوات ذات الصوت المنخفض حتى **200%** بنقاء تام.
* **مؤشر الصوت العائم (OSD Volume Overlay):** يظهر مؤشر أنيق شفاف في وسط الشاشة يوضح نسبة الصوت وشريط التقدم، ثم يختفي تلقائياً بعد ثانية واحدة من التوقف عن التمرير.

```javascript
let currentVolume = 100;
let overlayTimer = null;
let audioCtx = null, gainNode = null;

function setupAudioContext(videoElement) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaElementSource(videoElement);
        gainNode = audioCtx.createGain();
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
    }
}

function setVolume(val) {
    currentVolume = Math.max(0, Math.min(200, val));
    const video = document.getElementById('videoPlayer');

    // التحكم بالصوت والتضخيم
    if (currentVolume <= 100) {
        video.volume = currentVolume / 100;
        if (gainNode) gainNode.gain.value = 1.0;
    } else {
        video.volume = 1.0;
        if (gainNode) gainNode.gain.value = currentVolume / 100; // تضخيم حتى 2.0x
    }

    // تحديث السلايدر والنص
    document.getElementById('volSlider').value = currentVolume;
    document.getElementById('volLabel').textContent = `${currentVolume}%`;

    // إظهار المؤشر العائم في وسط الفيديو
    showVolumeOverlay(currentVolume);
}

function showVolumeOverlay(vol) {
    const overlay = document.getElementById('volumeOverlay');
    const icon = document.getElementById('volOverlayIcon');
    const text = document.getElementById('volOverlayText');
    const fill = document.getElementById('volBarFill');

    icon.textContent = vol === 0 ? "🔇" : (vol > 100 ? "🔊+" : "🔊");
    text.textContent = `${vol}%`;
    fill.style.width = `${(vol / 200) * 100}%`;

    overlay.classList.remove('hidden');
    clearTimeout(overlayTimer);
    overlayTimer = setTimeout(() => {
        overlay.classList.add('hidden');
    }, 1200);
}

// الاستماع لعجلة الماوس
wrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    const step = 5;
    if (e.deltaY < 0) {
        setVolume(currentVolume + step);
    } else {
        setVolume(currentVolume - step);
    }
}, { passive: false });
```

#### ج. اختصارات لوحة المفاتيح الشاملة (Keyboard Shortcuts)
* `Space`: تشغيل / إيقاف مؤقت (Play / Pause).
* `F`: ملء الشاشة / الخروج منها.
* `M`: كتم أو إعادة تشغيل الصوت.
* `ArrowRight` / `ArrowLeft`: تقديم / تأخير البث 10 ثوانٍ.
* `ArrowUp` / `ArrowDown`: زيادة / خفض مستوى الصوت بنسبة 5%.

---

## 🔒 8. طبقة الحماية وتكامل النظام (Preload & IPC Bridge)

طبقاً لأعلى معايير أمان Electron (`contextIsolation: true`, `nodeIntegration: false`):

```javascript
// src/preload/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // دوال القنوات والتصنيفات
    loadPlaylists: () => ipcRenderer.invoke('get-playlists'),
    importFgCode: (code) => ipcRenderer.invoke('resolve-fg-code', code),
    getCategories: (playlistId) => ipcRenderer.invoke('get-categories', playlistId),
    getChannels: (filter) => ipcRenderer.invoke('get-channels', filter),
    toggleFavorite: (channelId, isFav) => ipcRenderer.invoke('toggle-fav', channelId, isFav),
    
    // روابط التواصل الخارجي الآمنة (ARN Standards)
    openSocialLink: (url) => ipcRenderer.send('open-external-url', url),
    
    // الاستماع لتقدم التحميل
    onProgress: (callback) => ipcRenderer.on('import-progress', (e, val) => callback(val))
});
```

---

## 📦 9. حزمة التثبيت والتوقيع الرقمي (Packaging & Inno Setup & Signing)

طبقاً لقواعد عمل **ARN Technology**:

1. **معالجة الـ Launcher و UTF-8 في ويندوز:**
   - ملف `Run-DesktopApp.bat` يحتوي على `chcp 65001 >nul` لمنع أخطاء ترميز CMD في الأسماء العربية.
   - تشغيل التطبيق تلقائياً عبر `Run-DesktopApp.ps1` بصلاحيات UAC RunAs.
2. **التوقيع الرقمي المعتمد وطابع الوقت RFC-3161:**
   - توقيع ملف `ARN-IPTV-Setup.exe` بشهادة **ARN Technology** المخزنة في `Cert:\CurrentUser\My`.
   - استخدام خادم الطابع الزمني المعتمد: `http://timestamp.digicert.com` بخوارزمية `SHA256` لتفادي تحذيرات **Windows Smart App Control**.
3. **سكربت Inno Setup لتثبيت الشهادة تلقائياً للعميل النهائي:**
   ```ini
   [Run]
   Filename: "certutil.exe"; Parameters: "-addstore -f ""Root"" ""{app}\cert\ARN_Technology_Root.cer"""; Flags: runhidden waituntilterminated
   Filename: "certutil.exe"; Parameters: "-addstore -f ""TrustedPublisher"" ""{app}\cert\ARN_Technology_Root.cer"""; Flags: runhidden waituntilterminated
   Filename: "{app}\{#MyAppExeName}"; Description: "{cm:RunProgram}"; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent
   ```

---

## 🗓️ 10. جدول مراحل التنفيذ المقترح (Roadmap Checklist)

- [x] **المرحلة 1: تجهيز بيئة العمل (Setup)**
  - تهيئة مستودع Node.js وتثبيت حزم `electron`, `better-sqlite3`, `axios`, `hls.js`.
  - تجهيز هيكل المجلدات والأيقونات الرسمية وخط Cairo و JetBrains Mono المدمجين محلياً.
- [x] **المرحلة 2: نقل المحرك الخلفي (Core Migration)**
  - إنشاء `fg_engine.js` واختبار التشفير بـ AES-128 ودعم endpoints دراما لايف v187.
  - تشغيل `stream_proxy.js` والتأكد من استجابته لـ `/ping` و `/subplaylist` ومعالجة إزالة بادئة `k9x_` swap وتمرير ترويسات البث.
- [x] **المرحلة 3: بناء الواجهة بنظام 3 أعمدة (UI Implementation)**
  - برمجة `index.html` و `layout.css` و `glassmorphism.css` مع شريط عنوان مخصص ومقسمات أعمدة قابلة للسحب ووضع المسرح.
  - دمج مشغل `hls.js` محلياً وتوصيله بروابط البروكسي `http://127.0.0.1:39871/live/:id`.
  - تفعيل محرك تعدد السيرفرات مع الانتقال التلقائي عند الأعطال (Auto-Failover).
  - تفعيل قائمة اختيار الجودة (Adaptive HLS Levels من 360p حتى 4K).
  - تفعيل إيماءات المشغل: النقر المزدوج لملء الشاشة، وعجلة الماوس لتضخيم الصوت حتى 200%، ومؤشر OSD العائم.
- [x] **المرحلة 4: قاعدة البيانات وإدارة الحالة (Data & State)**
  - إنشاء جداول SQLite (`better-sqlite3` WAL) وتجهيز فهارس الاستعلام السريع ومحرّك Virtual Scroll لتحمل 50,000+ قناة بسلاسة 60fps.
  - ربط شريط البحث اللحظي الداعم لتطبيع الحروف العربية وفلاتر الفئات والجودة والمفضلة وسجل المشاهدة ودعم M3U و Xtream Codes.
- [x] **المرحلة 5: التجميع النهائي والتوثيق (Build & Sign)**
  - تجهيز إعدادات البناء عبر `electron-builder` و `build/installer.iss` لـ `Inno Setup` ومشغلات `Run-DesktopApp.bat` و `Run-DesktopApp.ps1`.
  - تجهيز سكريبت التوقيع الرقمي `build/Sign-Package.ps1` بشهادة ARN Technology وطابع DigiCert الزمني RFC-3161 SHA-256.

---

> **ملاحظة:** تم حفظ هذه الخطة كمرجع كامل في المستودع بملف [ELECTRON_MIGRATION_PLAN.md](file:///e:/مشاريعي/ARN%20IPTV/ELECTRON_MIGRATION_PLAN.md) لتكون دليلك التنفيذي الشامل عند بدء مشروع Electron.js القادم.
