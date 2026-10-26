# مشروع ARN IPTV Pro الأصلي لنظام أندرويد (Kotlin & Jetpack Compose)

خطة معمارية تفصيلية لبناء وتجهيز تطبيق أندرويد أصلي عالي الأداء (Native Android Application) يحمل نفس الهوية والوظائف المتقدمة لتطبيق **ARN IPTV Pro**، مبني بأحدث معايير Google الرسمية باستخدام **Kotlin**، **Jetpack Compose**، **Material 3**، و **AndroidX Media3 (ExoPlayer)**.

---

## مراجعة المستخدم والقرارات المحسومة

> [!IMPORTANT]
> **القرارات المؤكدة:**
> 1. **البنية المعمارية**: مشروع أندرويد أصلي 100% بلغة **Kotlin** مع واجهات **Jetpack Compose** الحديثة، ومحرك تشغيل وسائط **AndroidX Media3 / ExoPlayer**.
> 2. **الأجهزة المستهدفة**: دعم ثنائي هجين للهواتف الذكية والأجهزة اللوحية (Touch UI) مع دعم شاشات التلفاز الذكية وأجهزة التي في بوكس (Android TV / Google TV) عبر التنقل بالريموت كنترول (D-Pad Navigation).
> 3. **الهوية البصرية**: نقل نفس الهوية السينمائية الفاخرة الهادئة المستوحاة من **Apple TV & Bang & Olufsen** مع وضع السواد المطلق **Deep Black Mode (OLED #000000)**.

---

## 1. النظرة العامة والقدرات الجوهرية (Core Concept)

- **ما يقدمه التطبيق**: مشغل بث IPTV وقنوات فضائية وراديو عالي الاستقرار وخفيف الحجم، قادر على تشغيل قنوات دراما لايف المباشرة المشفرة (FG Codes)، واشتراكات سيرفرات **Xtream Codes** الرسمية، وقوائم **M3U / M3U8** المخصصة، دون أي اعتماد على مشغلات خارجية كـ VLC.
- **الجمهور المستهدف**: مستخدمو هواتف أندرويد الذكية، الأجهزة اللوحية، وأجهزة التلفاز (Android TV / TV Sticks) الباحثون عن تجربة بث تلفزيوني فورية خالية من الإعلانات ومن التقطيع.
- **القيمة المضافة**: فك تشفير حزم البث وإزالة بادئات التشويش (`k9x_`) مباشرة داخل التطبيق عبر محرك وسائط مخصص، مع تسريع عتادي GPU واستهلاك منخفض للبطارية وشاشة تلفزيونية مريحة للعين.

---

## 2. تجربة المستخدم والتصميم البصري (UX & Visual Design)

### تدفق الاستخدام الرئيسي (User Flows)
1. **شاشة الإقلاع السينمائية (Splash Screen)**: فحص سلامة التشفير، ومزامنة القنوات المخزنة محلياً في قاعدة بيانات **Room Database** السريعة.
2. **شاشة التصفح الرئيسية (Dual Layout)**:
   - **وضع الهاتف / التابلت**: شريط تنقل سفلي أو جانبي (Bottom / Navigation Rail) مع قائمة قنوات انسيابية بدون حدود صندوقية، وبحث فوري سريع.
   - **وضع التلفاز الذكي (Android TV / D-Pad)**: شريط تصنيفات أفقي علوي وبطاقات قنوات تتفاعل بحركة تكبير هادئة (Smooth Scale Focus) وإطار أبيض خفيف عند توجيه مؤشر الريموت.
3. **شاشة المشغل فائق الجودة (Cinema Player View)**:
   - مسار تحكم سفلي زجاجي شفاف يظهر ويختفي بسلاسة.
   - أزرار التبديل الفوري بين السيرفرات المتعددة وجودات البث، ومسارات الصوت (Multi-Audio Tracks).
   - دعم كامل لوضع صورة داخل صورة (Picture-in-Picture — PiP).
   - إيماءات لمسية على الهاتف لرفع الصوت حتى 200% وضبط الإضاءة بالسحب الرأسي.
4. **شاشة استوديو الراديو العربي (B&O Acoustic Studio)**: واجهة خاصة بمحطات الراديو تحتوي على قرص ترددي معدني مؤكسد ومؤشرات طيف موجي تفاعلية.

### لوحة الألوان والخطوط (Color & Typography)
- **الخلفية الأساسية**: حجر الأوبسيديان الداكن (`#06080e`) مع ميزة التبديل إلى السواد المطلق لشاشات أوليد (`#000000`).
- **اللمسات المميزة**: الزمردي الهادئ (`#10b981`) لمؤشرات البث الحي، والأبيض الناصع للنصوص النشطة.
- **الخطوط**: خط **Cairo** المدمج للنصوص العربية و **JetBrains Mono** للترددات وأرقام القنوات والبيانات الرقمية (`tabular-nums`).

---

## 3. القرارات التقنية والمفاضلات (Key Product Decisions)

### أ. فك تشفير دراما لايف وإزالة تشويش `k9x_` على أندرويد
- **الخيار المعتمد**: استخدام محرك تشفير أصلي عبر `javax.crypto.Cipher` (AES-128-CBC مع PKCS7Padding) مطابق تماماً لمحرك Node.js/Python، مع بناء **Custom ExoPlayer DataSource.Factory** يعترض طلبات روابط البث ويزيل بادئات التشويش ويحقن ترويسات `User-Agent: DramaLive/187` مباشرة دون الحاجة لإنشاء خادم HTTP محلي يستهلك موارد الجهاز.
- **السبب**: تقليل زمن استجابة بدء تشغيل القناة (Zero-Latency Stream Startup) وتفادي حظر تشغيل الخوادم المحلية على إصدارات أندرويد الحديثة (Android 14+ Power & Network Restrictions).

### ب. إدارة البيانات وحفظ القوائم
- **الخيار المعتمد**: **Room Database + Kotlin Coroutines & Flow**.
- **السبب**: استجابة فورية للبحث في آلاف القنوات دون تجميد واجهة المستخدم، وتخزين آمن للمفضلة وسجل المشاهدة.

### ج. تعدد المنصات داخل أندرويد (Mobile & TV Support)
- **الخيار المعتمد**: واجهة موحدة ذكية تكتشف نوع الجهاز عبر `UiModeManager` وتفعل نمط التركيز بالريموت كنترول (`Modifier.focusable()` و `LocalFocusManager`) تلقائياً على أجهزة التلفاز.

---

## 4. البنية المعمارية للمشروع (Technical Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ARN IPTV Pro — Native Android App                    │
├────────────────────────────────────────────────────────────────────────┤
│                               UI LAYER                                 │
│  ┌───────────────────────┐ ┌───────────────────┐ ┌──────────────────┐  │
│  │   HomeScreen (Mobile) │ │  TvHomeScreen(TV) │ │ CinemaPlayerView │  │
│  │   - Channels List     │ │  - D-Pad Focus    │ │ - ExoPlayer Host │  │
│  │   - Categories Rail   │ │  - Leanback Grid  │ │ - Glass Controls │  │
│  │   - Zero-Pill Rows    │ │  - Big Preview    │ │ - PiP & Audio 2x │  │
│  └───────────────────────┘ └───────────────────┘ └──────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│                            VIEWMODEL LAYER                             │
│       MainViewModel   ·   PlayerViewModel   ·   SettingsViewModel      │
├────────────────────────────────────────────────────────────────────────┤
│                             DOMAIN LAYER                               │
│  ┌─────────────────────┐ ┌───────────────────┐ ┌────────────────────┐  │
│  │ FgCryptoEngine      │ │ XtreamRepository  │ │ M3uParser          │  │
│  │ - AES-128-CBC       │ │ - Retrofit Client │ │ - Streaming Parser │  │
│  │ - Key / IV Handler  │ │ - Auth & Sync     │ │ - Channel Matcher  │  │
│  └─────────────────────┘ └───────────────────┘ └────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│                           MEDIA & DATA LAYER                           │
│  ┌─────────────────────────────────┐ ┌──────────────────────────────┐  │
│  │ AndroidX Media3 (ExoPlayer)     │ │ Room Local Database          │  │
│  │ - Custom HlsMediaSource         │ │ - Playlists & Categories     │  │
│  │ - CleanStreamDataSource (k9x_)  │ │ - Favorites & Watch History  │  │
│  └─────────────────────────────────┘ └──────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### هيكل ملفات المشروع المقترح داخل مجلد `android/`:
1. **إعدادات البناء Gradle**:
   - `android/build.gradle.kts`
   - `android/app/build.gradle.kts` (تضمين Media3, Compose, Room, Retrofit, Coroutines)
   - `android/settings.gradle.kts`
2. **التهيئة والصلاحيات**:
   - `android/app/src/main/AndroidManifest.xml` (أذونات الإنترنت، التلفاز الذكي، PiP، تشغيل الصوت في الخلفية)
3. **محرك التشفير والوسائط (Engine & Media)**:
   - `android/app/src/main/java/com/arn/iptv/engine/FgCryptoEngine.kt`
   - `android/app/src/main/java/com/arn/iptv/player/CleanStreamDataSource.kt`
   - `android/app/src/main/java/com/arn/iptv/player/ExoPlayerManager.kt`
4. **إدارة البيانات والاتصال**:
   - `android/app/src/main/java/com/arn/iptv/data/model/Channel.kt`
   - `android/app/src/main/java/com/arn/iptv/data/local/AppDatabase.kt`
   - `android/app/src/main/java/com/arn/iptv/data/remote/XtreamApiService.kt`
   - `android/app/src/main/java/com/arn/iptv/data/parser/M3uParser.kt`
5. **واجهات المستخدم (Jetpack Compose Screens)**:
   - `android/app/src/main/java/com/arn/iptv/ui/theme/Theme.kt` (Obsidian & Deep Black OLED)
   - `android/app/src/main/java/com/arn/iptv/ui/screens/MainScreen.kt`
   - `android/app/src/main/java/com/arn/iptv/ui/screens/PlayerScreen.kt`
   - `android/app/src/main/java/com/arn/iptv/ui/screens/RadioScreen.kt`
   - `android/app/src/main/java/com/arn/iptv/ui/screens/PlaylistDialog.kt`
6. **دليل البناء والتشغيل**:
   - ملف `android/README_ANDROID.md` يوضح خطوات فتح المشروع في **Android Studio** وتوليد ملف الـ **APK** أو حزمة **AAB** وتثبيتها مباشرة على الهواتف وشاشات التلفاز.

---

## 5. خطة التنفيذ خطوة بخطوة

1. **الخطوة الأولى**: إنشاء الهيكل الكامل لمشروع أندرويد وتجهيز ملفات البناء `build.gradle.kts` والإعدادات والأذونات في `AndroidManifest.xml`.
2. **الخطوة الثانية**: بناء المحركات الأساسية بلغة Kotlin:
   - محرك فك تشفير دراما لايف `FgCryptoEngine.kt` (AES-128-CBC متطابق 100%).
   - معالج ومزود الوسائط المخصص `CleanStreamDataSource.kt` لحذف بادئات `k9x_` وحقن الترويسات.
   - محلل ملفات M3U ومزامنة اشتراكات Xtream Codes.
3. **الخطوة الثالثة**: بناء قاعدة البيانات المحلية Room ونماذج القنوات والمفضلة وسجل المشاهدة.
4. **الخطوة الرابعة**: تطوير واجهات Jetpack Compose بالنمط السينمائي (الهواتف وشاشات التلفاز D-Pad).
5. **الخطوة الخامسة**: ربط مشغل Media3 ExoPlayer مع تسريع GPU و PiP ومضاعفة الصوت 200%.
6. **الخطوة السادسة**: إنشاء وثيقة التجميع والإرشادات `README_ANDROID.md` وفحص توافق وتكامل الأكواد.
