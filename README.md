<div align="center">

# 📺 ARN IPTV Pro (2026)
### مشغل ومنصة البث التلفزيوني والفضائي العربي الذكي
**تصميم وتطوير: عبده رجب نصار — شركة ARN Technology**

[![Version](https://img.shields.io/badge/Version-2.6.0-blue.svg?style=for-the-badge)](https://github.com/abdournassar95/ARN-IPTV)
[![Platform](https://img.shields.io/badge/Platform-Windows%20x64%20|%20Electron-success.svg?style=for-the-badge)](https://github.com/abdournassar95/ARN-IPTV)
[![Design](https://img.shields.io/badge/Design-Dark%20Glassmorphism-violet.svg?style=for-the-badge)](https://github.com/abdournassar95/ARN-IPTV)
[![Security](https://img.shields.io/badge/Security-Hardened%20(Helmet%20%2B%20SSRF%20Shield)-emerald.svg?style=for-the-badge)](https://github.com/abdournassar95/ARN-IPTV)

</div>

---

## 🌟 نظرة عامة (Overview)

**ARN IPTV Pro** هو تطبيق احترافي متقدم لتشغيل البث التلفزيوني عبر الإنترنت (IPTV / M3U / Xtream Codes)، مبني بأحدث معايير الويب وسطح المكتب بنمط الزجاج الداكن الفاخر (**Dark Glassmorphism**).

يوفر البرنامج تجربة مشاهدة سينمائية سلسة ومستقرة، مع دعم خوادم بروكسي داخلية لفك تشفير التدفقات، تخطي حظر CORS، ومعالجة بث HLS/m3u8 المباشر.

---

## ✨ المميزات الرئيسية (Key Features)

- 🎨 **واجهة زجاجية داكنة فائقة الجمال (Dark Glassmorphism UI):** مؤثرات بصرية راقية مع دعم كامل للغة العربية (RTL).
- ⚡ **محرك داخلي مدمج للبث (Embedded Local Streaming Engine):** خادم Express مدمج لإعادة توجيه وتحسين تدفقات m3u8 بدون تقطيع.
- 📡 **دعم اشتراكات متنوعة:** دعم كامل لملفات وقوائم M3U/M3U8 وروابط خوادم Xtream API مع استخراج ذكي للأقسام والقنوات.
- 🛡️ **حماية أمنية مشددة (Security Hardened):**
  - درع كامل ضد هجمات SSRF وتصفية العناوين الخاصة بالسحابة والشبكات الداخلية.
  - سياسات أمان Helmet و Content Security Policy (CSP) متوافقة مع مشغلات الفيديو.
  - حماية بيانات الاعتماد (Credentials Sanitization) لمنع تسريب بيانات المستخدم في السجلات.
  - قيود معدل الطلبات (Rate Limiting) لمنع الإغراق.
- 🔁 **نظام التبديل التلقائي للخوادم:** خوارزمية ذكية لاختيار أفضل خادم بديل في حال تعثر البث الأساسي.
- ⭐ **المفضلة والتاريخ وسجل المشاهدة:** إدارة كاملة للقنوات المفضلة مع بحث لحظي فوري.
- 💻 **تطبيق سطح مكتب معتمد لنظام ويندوز (Windows Desktop Application):** مدعوم بمثبت رسمي موقع رقمياً مع ميزة التحديث الفوري (In-Place Hot Patch).

---

## 🛠️ التقنيات المستخدمة (Tech Stack)

- **سطح المكتب:** [Electron.js](https://www.electronjs.org/) (Main & Preload Context Isolation Architecture)
- **الواجهة الأمامية:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Tailwind CSS 4](https://tailwindcss.com/)
- **الخادم الداخلي:** [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/) + [Helmet](https://helmetjs.github.io/) + [NodeCache](https://github.com/node-cache/node-cache)
- **مشغل الفيديو:** [Hls.js](https://github.com/video-dev/hls.js/) للتعامل مع بروتوكول HTTP Live Streaming
- **الأيقونات والتأثيرات:** [Lucide Icons](https://lucide.dev/) + [Motion](https://motion.dev/)

---

## 🚀 التشغيل والتطوير (Getting Started)

### المتطلبات المسبقة:
- [Node.js](https://nodejs.org/) الإصدار 20 أو أحدث
- مدير الحزم `npm`

### خطوات التثبيت والتشغيل المحلي:

```bash
# 1. استنساخ المستودع
git clone https://github.com/abdournassar95/ARN-IPTV.git
cd ARN-IPTV

# 2. تثبيت الحزم البرمجية
npm install --legacy-peer-deps

# 3. تشغيل وضع التطوير المحلي
npm run dev

# 4. تشغيل تطبيق سطح المكتب (Electron)
npm run electron:start
```

### بناء الحزم والتوزيع (Production Build):

```bash
# بناء حزمة سطح المكتب كبرنامج تثبيت رسمي لنظام ويندوز
npm run electron:dist

# بناء حزمة محمولة بدون تثبيت (Portable)
npm run electron:portable
```

---

## 👨‍💻 المطور وحقوق الملكية (Developer & Copyright)

- **اسم الشركة:** ARN Technology
- **تطوير وبرمجة:** عبده رجب نصار (Abdo Ragab Nassar)
- **حقوق النشر:** جميع الحقوق محفوظة © 2026 لشركة ARN Technology.

### 🌐 قنوات التواصل الرسمية:
- **WhatsApp:** [+201556710314](https://wa.me/201556710314)
- **Telegram:** [@ABDOURNASSAR95](https://t.me/ABDOURNASSAR95)
- **Facebook:** [abdouragab.nassar](https://www.facebook.com/abdouragab.nassar)
- **Messenger:** [abdouragab.nassar](https://m.me/abdouragab.nassar)
- **GitHub:** [@abdournassar95](https://github.com/abdournassar95)

---

<div align="center">
  <sub>صنع بكل فخر واعتزاز بواسطة <b>عبده رجب نصار</b> — شركة <b>ARN Technology</b> © 2026</sub>
</div>
