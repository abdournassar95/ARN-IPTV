# دليل مشروع ARN IPTV Pro الأصلي لنظام أندرويد (Kotlin & Jetpack Compose)

تم بناء وتوليد هذا المشروع كنسخة أندرويد أصلية كاملة 100% (**Native Android Project**) لتطبيق **ARN IPTV Pro** بتطوير وبرمجة **عبده رجب نصار — شركة ARN Technology**.

---

## 🌟 مميزات نسخة أندرويد الأصلية
1. **أداء خام سريع بدون وسائط ويب**: مبني بالكامل بأحدث حزم Google الرسمية:
   - لغة **Kotlin 2.1**.
   - واجهات تفاعلية بالكامل عبر **Jetpack Compose** بنمط التصميم الفاخر الهادئ (Quiet Cinematic Luxury) المستوحى من **Apple TV & Bang & Olufsen**.
   - دعم الوضع الليلي الحقيقي **Deep Black Mode (OLED #000000)** لإطفاء بكسلات الشاشة وتوفير البطارية.
2. **محرك وسائط Media3 (ExoPlayer)**:
   - فك تشفير وتسريع عتادي GPU للبث المباشر وقوائم HLS التكيفية.
   - مضاعفة مستوى الصوت حتى **200% (Audio Boost)** عبر معالج `LoudnessEnhancer`.
   - التبديل التلقائي السلس بين السيرفرات عند انقطاع البث (Auto-Failover).
   - دعم وضع صورة داخل صورة (**Picture-in-Picture — PiP**).
3. **محرك فك تشفير دراما لايف الأصلي (FgCryptoEngine)**:
   - تشفير وفك تشفير AES-128-CBC مع PKCS7Padding ومعالجة كود التفعيل `KEY_ACTIVATED_TYPE v187`.
   - معالج `CleanStreamDataSource` المدمج مع ExoPlayer الذي يزيل تشويش `k9x_` ويحقن ترويسات `DramaLive/187` فورياً دون استهلاك الذاكرة.
4. **دعم التلفاز الذكي وأجهزة الاستقبال (Android TV / Google TV)**:
   - دعم كامل للتحكم بأزرار الريموت كنترول (D-Pad Navigation).
   - واجهة انسيابية تتنقل وتكبر بسلاسة عند التركيز.
5. **قاعدة بيانات محلية فائقة السرعة (Room Database)**:
   - حفظ القوائم، المفضلة، وسجل المشاهدة بدون اتصال بالإنترنت.
6. **دعم كافة مصادر البث**:
   - أكواد دراما لايف (FG Code).
   - اشتراكات وسيرفرات **Xtream Codes API**.
   - روابط وملفات **M3U / M3U8**.
   - باقة القنوات المصرية الرسمية وإذاعات القرآن الكريم والراديو العربي مدمجة وجاهزة للعمل فوراً.

---

## 📁 هيكلية ملفات المشروع (Project Structure)

```
android/
├── build.gradle.kts                   # إعدادات البناء الجذرية
├── settings.gradle.kts                # إدارة الموديولات والمستودعات
├── gradle.properties                  # إعدادات الذاكرة و AndroidX
├── gradle/
│   └── libs.versions.toml             # كتالوج إصدارات الحزم والمكتبات
└── app/
    ├── build.gradle.kts               # إعدادات التطبيق والمكتبات (Media3, Compose, Room, Retrofit)
    ├── proguard-rules.pro             # قواعد حماية الكود وتصغير حجم الـ APK
    └── src/main/
        ├── AndroidManifest.xml        # الأذونات وتوافق الهواتف والتلفاز و PiP
        ├── res/                       # الموارد والألوان والأنماط
        └── java/com/arn/iptv/
            ├── MainActivity.kt        # نقطة انطلاق التطبيق وإدارة الحالة
            ├── engine/
            │   └── FgCryptoEngine.kt  # محرك AES-128-CBC لفك تشفير دراما لايف
            ├── player/
            │   ├── CleanStreamDataSource.kt # معالج ExoPlayer لحذف تشويش k9x_
            │   └── ExoPlayerManager.kt      # مدير المشغل ومضاعف الصوت 200%
            ├── data/
            │   ├── model/Models.kt          # كائنات البيانات (القنوات، السيرفرات، التصنيفات)
            │   ├── catalog/BuiltinCatalog.kt # كتالوج قنوات مصر وإذاعات الراديو المدمج
            │   ├── local/                   # قاعدة بيانات Room (Entity, Dao, Database)
            │   ├── parser/M3uParser.kt      # محلل قوائم M3U المتقدم
            │   └── remote/XtreamApiService.kt # عميل Xtream Codes الرسمي
            └── ui/
                ├── theme/                   # الألوان وأنماط شاشات OLED
                └── screens/
                    ├── MainScreen.kt        # الشاشة الرئيسية للهواتف وشاشات التلفاز D-Pad
                    ├── PlayerScreen.kt      # شاشة المشغل السينمائي الزجاجي
                    ├── RadioScreen.kt       # استوديو الراديو بقرص B&O الصوتي
                    └── PlaylistDialog.kt    # نافذة تفعيل الأكواد واشتراكات Xtream
```

---

## 🚀 كيفية فتح المشروع وبناء ملف الـ APK في Android Studio

### المتطلبات الأساسية:
- بيئة **Android Studio** (نسخة Koala أو Ladybug أو أحدث) أو تثبيت أدوات سطر الأوامر لنظام أندرويد SDK 35.
- تثبيت حزمة **Java Development Kit (JDK 17 أو أحدث)**.

### خطوات البناء:
1. قم بفتح برنامج **Android Studio**.
2. اختر **Open** ثم حدد مجلد `android` الموجود داخل المشروع.
3. انتظر انتهاء مزامنة Gradle (Gradle Sync) وتحميل الحزم تلقائياً من المستودعات.
4. **لتشغيل التطبيق على الهاتف أو المحاكي (Emulator)**:
   - قم بتوصيل هاتف أندرويد عبر كابل USB مع تفعيل خيار تصحيح أخطاء USB (USB Debugging)، أو شغل جهاز محاكي أندرويد / Android TV.
   - اضغط على زر **Run (▶)** في شريط الأدوات العلوي.

5. **لتوليد ملف تثبيت APK جاهز للإرسال (Build APK)**:
   - من القائمة العلوية اختر: **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**.
   - أو عبر سطر الأوامر (Terminal):
     ```bash
     cd android
     ./gradlew assembleRelease
     ```
   - ستجد ملف الـ APK الناتج داخل المسار:
     `android/app/build/outputs/apk/release/app-release-unsigned.apk`

---

## 📺 تثبيت التطبيق على أجهزة التلفاز الذكية (Android TV / Fire TV)
- يمكنك إرسال ملف الـ APK مباشرة إلى شاشة التلفاز باستخدام تطبيق **Send Files to TV** المتوفر مجاناً على متجر Google Play للتلفاز.
- أو عبر أداة `adb` من جهاز الكمبيوتر:
  ```bash
  adb connect IP_ADDRESS_OF_TV
  adb install app-release.apk
  ```

---

## 🔒 الأمان وتشفير البيانات
- كافة الاتصالات بسيرفرات دراما لايف مشفرة بنفس المعيار العسكري المستخدم في التطبيق الرسمي.
- لا توجد أي إعلانات أو برمجيات تتبع أو تسريب لبيانات حسابات Xtream للمستخدمين.

**تطوير وبرمجة: عبده رجب نصار — شركة ARN Technology © 2026**
