# دليل رفع كود أندرويد لفرع منفصل على GitHub والبناء التلقائي لملف APK

تم تجهيز ملف الأتمتة الكامل **GitHub Actions Workflow** داخل المشروع في المسار:
`.github/workflows/build-android-apk.yml`

يقوم هذا السكريبت ببناء تطبيق أندرويد تلقائياً على خوادم GitHub وتوليد ملف تثبيت **APK** رسمي جاهز للتحميل والتثبيت المباشر على الهواتف وشاشات التلفاز دون الحاجة لتثبيت أي برامج على جهازك!

---

## 🚀 خطوات رفع الكود لفرع منفصل (مثلاً: `android-release`)

افتح موجه الأوامر (Terminal أو Git Bash) في مجلد المشروع، ونفذ الأوامر التالية:

### 1. تهيئة مستودع Git (إن لم يكن مهيئاً):
```bash
git init
```

### 2. إنشاء والانتقال إلى فرع منفصل مخصص للأندرويد:
```bash
git checkout -b android-release
```

### 3. إضافة وتثبيت مجلد الأندرويد وإعدادات GitHub Actions:
```bash
git add android/ .github/
git commit -m "feat(android): Add native Kotlin Android project & CI/CD APK builder"
```

### 4. ربط مستودع GitHub الخاص بك (استبدل الرابط برابط مستودعك):
```bash
git remote add origin https://github.com/USERNAME/REPO_NAME.git
# إذا كان الريموت موجوداً مسبقاً:
# git remote set-url origin https://github.com/USERNAME/REPO_NAME.git
```

### 5. رفع الفرع المنفصل إلى GitHub:
```bash
git push -u origin android-release
```

---

## ⚡ كيف يعمل البناء التلقائي على GitHub؟

بمجرد رفع الكود إلى فرع `android-release` أو `android` أو `main`:
1. سيبدأ **GitHub Actions** تلقائياً في العمل في تبويب **Actions** داخل مستودعك على GitHub.
2. يتم تجهيز بيئة Ubuntu السحابية، تثبيت حزمة **Java 17 (JDK)**، و **Android SDK 35**.
3. يتم تجميع كود الكوتلن وبناء نسختي الـ APK:
   - `ARN-IPTV-Pro-v2.6.0-Release.apk`
   - `ARN-IPTV-Pro-v2.6.0-Debug.apk`
4. يتم رفع ملفات الـ APK تلقائياً في قسم **Artifacts** أسفل صفحة تشغيل الـ Action.
5. يمكنك تنزيل ملف الـ APK فوراً من صفحة GitHub ونقله لهاتفك لتثبيته وتشغيله!

---

## 🛠️ تشغيل البناء يدوياً بضغطة زر (Manual Trigger):
1. اذهب إلى صفحة المستودع على GitHub.
2. اضغط على تبويب **Actions** في الأعلى.
3. اختر من القائمة الجانبية: **Build Android APK (ARN IPTV Pro)**.
4. اضغط على زر **Run workflow**، واختر الفرع `android-release` ونوع البناء (`release`).
5. سيبدأ البناء وينتج لك ملف الـ APK خلال 3 دقائق تقريباً!
