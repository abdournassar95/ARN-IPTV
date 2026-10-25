# 🚀 خريطة طريق ترقية ARN IPTV Pro v2.6.0 → v3.0.0

## 📋 دليل التنفيذ الشامل

---

## 🏗️ التقسيم العام — 6 مراحل رئيسية

| المرحلة | الاسم | الوقت الكلي | المميزات |
|---------|-------|-------------|----------|
| **المحلة 0** | إعداد وتجهيز البنية | 3 ساعات | TypeScript strict, ESLint, Prettier, modularization |
| **المحلة 1** | تحسينات أداء فورية | 5 ساعات | IndexedDB, Service Worker, Virtual Scrolling |
| **المحلة 2** | ميزات الفيديو المتقدمة | 6 ساعات | PIP, Recording, Audio Tracks, Quality Detection |
| **المحلة 3** | تجربة المستخدم والتوطين | 8 ساعات | Dark/Light Mode, i18n, EPG Guide |
| **المحلة 4** | التوزيع والتحديث التلقائي | 4 ساعات | Auto-Updater, Docker, Installer Enhancements |
| **المحلة 5** | Monitoring & Analytics | 3 ساعات | Sentry, Log Rotation, Update Checker |
| **الإجمالي** | — | **~29 ساعة عمل** | — |

---

## المرحلة 0: إعداد وتجهيز البنية 🔧

### 0.1 تفعيل TypeScript Strict Mode

**الملف:** `tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "strict": true,                    // ✅ فعل الـ strict
    "noImplicitAny": true,             // ✅ منع أي变變 var
    "strictNullChecks": true,          // ✅ null checking صارم
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noUnusedLocals": true,            // ⚠️ ممكن يتعطل شوية
    "noUnusedParameters": true,        // ⚠️ ممكن يتعطل شوية
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "dist-server"]
}
```

**ما يحدث بعد التعديل:**
- أخطاء TypeScript في أماكن كمان كانت متغابشة (`any`, `undefined`)
- لازم تصلح كل الـ errors قبل ما تكمل

---

### 0.2 إضافة ESLint + Prettier

#### تثبيت الحزم:
```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier eslint-config-prettier eslint-plugin-react eslint-plugin-jsx-a11y
```

#### إنشاء `.eslintrc.cjs`:
```javascript
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'jsx-a11y'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:jsx-a11y/recommended',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'react/react-in-jsx-scope': 'off', // React 19
    'jsx-a11y/alt-text': ['warn', { elements: ['img'], img: ['Alt'] }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  settings: {
    react: { version: 'detect' },
  },
};
```

#### إنشاء `.prettierrc`:
```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": false,
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

#### إضافة scripts لـ `package.json`:
```json
{
  "scripts": {
    "lint": "eslint src/ --ext .ts,.tsx",
    "lint:fix": "eslint src/ --ext .ts,.tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,json,css}\"",
    "typecheck": "tsc --noEmit"
  }
}
```

#### تنفيذ أول مرة:
```bash
npm run format          # ينسق كل الملفات
npm run lint:fix        # يصلح أخطاء ESLint اللي يمكن إصلاحها أوتوماتيكياً
npm run typecheck       # يتأكد من النوع
```

---

### 0.3 إعادة تنظيم ملفات السيرفر

```
server/                          # مجلد جديد
├── index.ts                     # إعداد التطبيق والـ middleware
├── routes/
│   ├── index.ts                 # aggregate كل الـ routes
│   ├── m3uRoutes.ts             # /api/m3u/*
│   ├── xtreamRoutes.ts          # /api/xtream/*
│   ├── fgRoutes.ts              # /api/fg/*
│   └── proxyRoutes.ts           # /api/proxy/*
├── services/
│   ├── streamService.ts         # Stream resolution logic
│   ├── playlistService.ts       # M3U parsing + Xtream sync
│   └── catalogService.ts        # Built-in catalogs
├── utils/
│   ├── validation.ts            # SSRF, URL validation
│   ├── rateLimiter.ts           # Rate limiters config
│   └── logging.ts               # Winston logger setup
└── config/
    └── security.ts              # Security constants
```

#### `server/index.ts` — نقطة البداية الجديدة:
```typescript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { apiLimiter, authLimiter, m3uLimiter } from './utils/rateLimiter';
import { logRequest, errorHandler } from './utils/logging';
import routes from './routes';

const app = express();

// Middlewares
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || [] }));
app.use(express.json({ limit: process.env.JSON_LIMIT || '1mb' }));
app.use(logRequest);

// Routes (مع rate limiting مناسب)
app.use('/api/m3u', m3uLimiter, routes.m3u);
app.use('/api/xtream', apiLimiter, routes.xtream);
app.use('/api/fg', authLimiter, routes.fg);
app.use('/api/proxy', routes.proxy);

// Error handler final
app.use(errorHandler);

export default app;
```

#### `server/routes/index.ts`:
```typescript
import { Router } from 'express';
import m3uRouter from './m3uRoutes';
import xtreamRouter from './xtreamRoutes';
import fgRouter from './fgRoutes';
import proxyRouter from './proxyRoutes';

const router = Router();

router.use('/m3u', m3uRouter);
router.use('/xtream', xtreamRouter);
router.use('/fg', fgRouter);
router.use('/proxy', proxyRouter);

export default router;
```

**مثال — `server/routes/xtreamRoutes.ts`:**
```typescript
import { Router } from 'express';
import { authenticateXtream, syncXtreamAccount } from '../services/playlistService';

const router = Router();

router.post('/authenticate', authenticateXtream);
router.post('/sync', syncXtreamAccount);

export default router;
```

**النتيجة:** كل endpoint بتاعه ملف منفصل، الكود بكون أنظف وأسهل للصيانة والـ testing.

---

## المرحلة 1: تحسينات الأداء ⚡

### 1.1 تحويل LocalStorage → IndexedDB

#### تثبيت المكتبات:
```bash
npm install idb-keyval
```

#### إنشاء `src/lib/storage.ts`:
```typescript
import { set, get, del, clear, keys } from 'idb-keyval';

const STORAGE_PREFIX = 'arn_iptv_v3_';

function prefixedKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

// ✅ Async Storage Manager
export const storage = {
  async save<T>(key: string, data: T): Promise<void> {
    try {
      await set(prefixedKey(key), data);
    } catch (err) {
      console.error(`Failed to save ${key}:`, err);
    }
  },

  async load<T>(key: string, fallback?: T): Promise<T> {
    try {
      const data = await get<T>(prefixedKey(key));
      if (data === undefined) return fallback as T;
      
      // Integrity check
      if (Array.isArray(data)) {
        return data.filter(item => item !== null && typeof item === 'object') as T;
      }
      return data;
    } catch {
      console.warn(`Corrupted data in ${key}, using fallback`);
      return fallback as T;
    }
  },

  async remove(key: string): Promise<void> {
    await del(prefixedKey(key));
  },

  async clear(): Promise<void> {
    const allKeys = await keys();
    for (const key of allKeys) {
      if (key.startsWith(STORAGE_PREFIX)) {
        await del(key);
      }
    }
  },

  // Helpers للبيانات الكبيرة
  async savePlaylist(playlistId: string, playlist: unknown): Promise<void> {
    await save(`playlist_${playlistId}`, playlist);
  },

  async loadPlaylists(): Promise<unknown[]> {
    return await load('playlists', []) as unknown[];
  },
};
```

#### تعديل `src/App.tsx` لاستخدام الـ new storage:
```typescript
// ❌ قبل
const [playlists, setPlaylists] = useState<PlaylistSource[]>(() => {
  const saved = localStorage.getItem('arn_iptv_clean_v5_playlists');
  return saved ? JSON.parse(saved) : [];
});

// ✅ بعد — async + IndexedDB
const [playlists, setPlaylists] = useState<PlaylistSource[]>([]);

useEffect(() => {
  storage.load<PlaylistSource[]>('playlists').then(setPlaylists);
}, []);

// دالة الحفظ الجديدة
const savePlaylists = async (newPlaylists: PlaylistSource[]) => {
  setPlaylists(newPlaylists);
  await storage.save('playlists', newPlaylists.slice(0, 2000)); // حد أكبر!
};
```

**الفوائد:**
- Limit من ~5MB لـ 50GB+
- لا حاجة لـ JSON.stringify/parse
- Async عشان لا blocking main thread
- integrity check أوتوماتيك

---

### 1.2 إضافة Service Worker (Offline Support)

#### تثبيت Workbox:
```bash
npm install workbox-webpack-plugin workbox-core workbox-routing workbox-strategies --save-dev
```

#### إنشاء `src/sw.ts`:
```typescript
/// <reference lib="webworker" />
import { precacheAndRoute, cleanDocs } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare selfWithSWTINWorkboxGlobalSkipWaitingClientMessagePort;

// Precache build assets
precacheAndRoute(selfManifest);

// Cache static assets with expiration
registerRoute(
  ({ request }) => request.destination === 'styleSheet',
  new CacheFirst({
    cacheName: 'styles-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
);

// Network-first for API requests
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 5 * 60 }),
    ],
  })
);

// Handle skip-waiting for instant updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Notify clients on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
```

#### تحديث `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { ManifestOptions } from 'workbox-build';

const workboxManifest: ManifestOptions = {
  swSrc: 'src/sw.ts',
  swDest: 'dist/sw.js',
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // ... باقي الإعداد
});
```

#### تسجيل الـ Service Worker في `src/main.tsx`:
```typescript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered:', registration.scope);
        
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Update available!
              window.postMessage({ type: 'UPDATE_AVAILABLE' });
            }
          });
        });
      })
      .catch(error => console.error('SW registration failed:', error));
  });
}
```

**النتيجة:**
- الكاتالوجات المحملة محلياً تبقى متاحة بدون إنترنت
- التحديثات يتم تلقائياً عند توفر نسخة جديدة
- سرعة تحميل أسرع للتطبيقات المستقبلية

---

### 1.3 Virtual Scrolling للقنوات

#### تثبيت TanStack Virtual:
```bash
npm install @tanstack/react-virtual
```

#### إنشاء `src/components/VirtualChannelList.tsx`:
```typescript
import { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import ChannelCard from './ChannelCard';

interface VirtualChannelListProps {
  channels: ChannelItem[];
  onChannelSelect: (channel: ChannelItem) => void;
}

export default function VirtualChannelList({
  channels,
  onChannelSelect,
}: VirtualChannelListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // approximate height per channel
    overscan: 5,
  });

  return (
    <div 
      ref={parentRef}
      style={{ height: '100%', overflow: 'auto' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => (
          <ChannelCard
            key={virtualRow.index}
            channel={channels[virtualRow.index]}
            onSelect={() => onChannelSelect(channels[virtualRow.index])}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

**الاستبدال في `App.tsx`:**
```typescript
// ❌ قبل (render كل القنوات)
{filteredChannels.map(channel => (
  <ChannelCard key={channel.id} channel={channel} onSelect={selectChannel} />
))}

// ✅ بعد (render الظاهرة فقط ~20 عنصر)
<VirtualChannelList 
  channels={filteredChannels} 
  onChannelSelect={selectChannel}
/>
```

**الأثر:** إذا كان لديك 2000 قناة — بدل ما render 2000 element DOM، بيظهر بس 20-30 عنصر!

---

## المرحلة 2: ميزات الفيديو المتقدمة 🎬

### 2.1 Picture-in-Picture (PiP)

#### إضافة للـ player component:
```typescript
// HlsVideoPlayer.tsx

const togglePiP = useCallback(async () => {
  const video = videoRef.current;
  if (!video) return;

  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await video.requestPictureInPicture();
    }
  } catch (error) {
    console.error('PiP failed:', error);
    setErrorMsg('❌ فشل تشغيل وضع صورة داخل صورة');
  }
}, []);

// UI button
<button
  onClick={togglePiP}
  title="وضع صورة داخل صورة"
  className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition"
>
  <PiP size={20} />
</button>
```

---

### 2.2 Video Recording (تسجيل البث)

#### تثبيت deps:
```bash
npm install ffprobe-static
```

#### إضافة service تسجيل في `src/services/recordingService.ts`:
```typescript
import { ipcRenderer } from 'electron';

export class RecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private recordingStartTime: Date | null = null;

  async startRecording(stream: MediaStream, fileName: string): Promise<void> {
    this.chunks = [];
    this.recordingStartTime = new Date();

    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm; codecs="vp9"')
        ? 'video/webm; codecs="vp9"'
        : 'video/webm',
      videoBitsPerSecond: 5000000, // 5 Mbps quality
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = async () => {
      const blob = new Blob(this.chunks, { type: 'video/webm' });
      
      // Save via Electron IPC
      if (window.electronAPI?.saveRecording) {
        const arrayBuffer = await blob.arrayBuffer();
        await window.electronAPI.saveRecording(fileName, arrayBuffer);
      }
      
      this.chunks = [];
      this.recordingStartTime = null;
    };

    this.mediaRecorder.start(1000); // Collect data every second
  }

  stopRecording(): Blob | null {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      return null; // Async — result comes via electronAPI
    }
    return null;
  }

  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  get duration(): number {
    if (!this.recordingStartTime) return 0;
    return Math.floor((Date.now() - this.recordingStartTime.getTime()) / 1000);
  }
}

export const recordingService = new RecordingService();
```

#### تحديث `HlsVideoPlayer.tsx`:
```typescript
// Add state
const [isRecording, setIsRecording] = useState(false);
const [recordDuration, setRecordDuration] = useState(0);

// Timer untuk countdown recording
useEffect(() => {
  let interval: NodeJS.Timeout;
  if (isRecording) {
    interval = setInterval(() => {
      setRecordDuration(recordingService.duration);
    }, 1000);
  }
  return () => clearInterval(interval);
}, [isRecording]);

// Toggle recording handler
const toggleRecording = useCallback(() => {
  if (isRecording) {
    recordingService.stopRecording();
    setIsRecording(false);
    setRecordDuration(0);
  } else {
    const stream = videoRef.current?.captureStream();
    if (stream) {
      recordingService.startRecording(stream, `recording_${Date.now()}.webm`);
      setIsRecording(true);
    }
  }
}, [isRecording]);

// Duration formatter
const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// UI
{isRecording && (
  <div className="flex items-center gap-2 text-red-500">
    <span className="animate-pulse">●</span>
    <span>جارِ التسجيل: {formatDuration(recordDuration)}</span>
  </div>
)}

<button onClick={toggleRecording} title="تسجيل البث">
  {isRecording ? <Stop size={20} /> : <Mic size={20} />}
</button>
```

#### إضافة في preload لإرسال الملف للمستخدم:
```javascript
// preload.cjs
ipcMain.handle('save-recording', async (_event, filename: string, buffer: ArrayBuffer) => {
  const dialog = await dialog.showSaveDialog(mainWindow, {
    title: 'حفظ التسجيل',
    defaultPath: `downloads/${filename}`,
    filters: [{ name: 'WebM', extensions: ['webm'] }],
  });
  
  if (!dialog.canceled && dialog.filePath) {
    await fs.writeFile(dialog.filePath, Buffer.from(buffer));
    return { success: true, path: dialog.filePath };
  }
  return { success: false };
});
```

---

### 2.3 Multiple Audio Track Selection

```typescript
// HlsVideoPlayer.tsx — عند initializing HLS
const handleManifestParsed = useCallback((_event: string, data: any) => {
  if (data.audioTracks && data.audioTracks.length > 1) {
    setHasMultipleAudioTracks(true);
    setAudioTracks(data.audioTracks);
  }
}, []);

// Audio selector dropdown
{hasMultipleAudioTracks && audioTracks.length > 1 && (
  <select
    value={currentAudioTrackIndex}
    onChange={(e) => {
      const index = Number(e.target.value);
      hlsInstance?.setAudioTrack(index);
      setCurrentAudioTrackIndex(index);
    }}
    className="bg-gray-700 text-white px-2 py-1 rounded"
  >
    {audioTracks.map((track, idx) => (
      <option key={track.id} value={idx}>
        {track.name || `الصوت ${idx + 1}`}
      </option>
    ))}
  </select>
)}

// On stream switch, reset audio track selection
useEffect(() => {
  setCurrentAudioTrackIndex(0);
  setHasMultipleAudioTracks(false);
  setAudioTracks([]);
}, [currentStreamUrl]);
```

---

### 2.4 Quality Auto-Detection

```typescript
// src/services/qualityDetector.ts
export interface BandwidthEstimate {
  kbps: number;
  timestamp: number;
}

class QualityDetector {
  private estimates: BandwidthEstimate[] = [];
  private readonly MAX_SAMPLES = 30;

  sampleBandwidth(bitrateBits: number): void {
    this.estimates.push({
      kbps: bitrateBits / 1000,
      timestamp: Date.now(),
    });

    if (this.estimates.length > this.MAX_SAMPLES) {
      this.estimates.shift();
    }
  }

  getRecommendedQuality(qualities: HlsQualityLevel[]): HlsQualityLevel {
    if (this.estimates.length < 5) {
      return qualities[0]; // Default if not enough samples
    }

    // Average bandwidth over recent samples
    const avgKbps = this.estimates.reduce((sum, e) => sum + e.kbps, 0) / this.estimates.length;
    
    // Find best quality that fits bandwidth with 20% margin
    const targetKbps = avgKbps * 0.8;
    
    let bestMatch = qualities[qualities.length - 1];
    for (const q of qualities.sort((a, b) => b.height - a.height)) {
      if (q.bandwidth / 1000 <= targetKbps) {
        bestMatch = q;
        break;
      }
    }

    return bestMatch;
  }

  reset(): void {
    this.estimates = [];
  }
}

export const qualityDetector = new QualityDetector();
```

#### دمج مع Player:
```typescript
// At level loading
hlsInstance.on(HlsEvents.LEVEL_SWITCHED, () => {
  const currentLevel = hlsInstance.levels[hlsInstance.currentLevel];
  if (currentLevel) {
    qualityDetector.sampleBandwidth(currentLevel.bitrate);
  }
});

// Auto-switch quality option
useEffect(() => {
  const recommended = qualityDetector.getRecommendedQuality(hlsInstance?.levels || []);
  if (recommended && recommended.qualityId !== currentQuality) {
    hlsInstance?.currentLevel = levels.findIndex(l => l.qualityId === recommended.qualityId);
  }
}, [hlsEvent.bandwidth]); // Trigger when bandwidth changes
```

---

## المرحلة 3: تجربة المستخدم والتوطين 🎨

### 3.1 Dark/Light Theme System

#### تعديل `index.css`:
```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

/* Custom theme variables */
:root {
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f3f4f6;
  --color-text-primary: #1f2937;
  --color-text-secondary: #6b7280;
  --color-accent: #3b82f6;
  --color-card-bg: #ffffff;
  --color-border: #e5e7eb;
}

.dark {
  --color-bg-primary: #0f172a;
  --color-bg-secondary: #1e293b;
  --color-text-primary: #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-accent: #60a5fa;
  --color-card-bg: #1e293b;
  --color-border: #334155;
}

body {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.bg-theme-primary { background-color: var(--color-bg-primary); }
.bg-theme-secondary { background-color: var(--color-bg-secondary); }
.text-theme-primary { color: var(--color-text-primary); }
.text-theme-secondary { color: var(--color-text-secondary); }
```

#### إنشاء `src/hooks/useTheme.ts`:
```typescript
import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('arn_theme') as Theme) || 'system';
  });

  const applyTheme = (selectedTheme: Theme) => {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = selectedTheme === 'dark' || 
      (selectedTheme === 'system' && systemPrefersDark);

    document.documentElement.classList.toggle('dark', shouldBeDark);
    localStorage.setItem('arn_theme', selectedTheme);
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen to system preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return { theme, setTheme: setThemeState, toggleTheme: () => {}};
}
```

#### Theme Toggle Button Component:
```typescript
// src/components/ThemeToggle.tsx
import { Moon, Sun, Monitor } from 'lucide-react';

interface ThemeToggleProps {
  theme: 'light' | 'dark' | 'system';
  onChange: (theme: Theme) => void;
}

export default function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  const icons = {
    light: <Sun size={18} />,
    dark: <Moon size={18} />,
    system: <Monitor size={18} />,
  };

  const themes: Array<{ value: Theme; label: string }> = [
    { value: 'light', label: 'فاتح' },
    { value: 'dark', label: 'داكن' },
    { value: 'system', label: 'نظام' },
  ];

  return (
    <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
      {themes.map(t => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`p-1.5 rounded transition-all ${
            theme === t.value 
              ? 'bg-gray-600 text-white shadow-sm' 
              : 'text-gray-400 hover:text-white'
          }`}
          title={t.label}
        >
          {icons[t.value]}
        </button>
      ))}
    </div>
  );
}
```

#### استخدام في App.tsx:
```typescript
const { theme, setTheme } = useTheme();

// In the header/navbar:
<ThemeToggle theme={theme} onChange={setTheme} />
```

---

### 3.2 نظام تعدد اللغات (i18n)

#### تثبيت الحزم:
```bash
npm install i18next react-i18next i18next-browser-languagedetector
```

#### إنشاء `src/i18n.ts`:
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Detector from 'i18next-browser-languagedetector';

// Arabic translations
const ar = {
  common: {
    appName: 'ARN IPTV Pro',
    version: 'الإصدار',
    loading: 'جارٍ التحميل...',
    error: 'حدث خطأ',
    cancel: 'إلغاء',
    save: 'حفظ',
    delete: 'حذف',
    search: 'بحث...',
    noResults: 'لا توجد نتائج',
  },
  player: {
    volume: 'الصوت',
    fullscreen: 'ملء الشاشة',
    pip: 'صورة داخل صورة',
    record: 'تسجيل',
    recording: 'جارٍ التسجيل',
    quality: 'الجودة',
    audioTrack: 'الممر الصوتي',
    buffering: 'جارٍ التحميل...',
  },
  channels: {
    favorites: 'المفضلة',
    history: 'سجل المشاهدة',
    categories: 'التصنيفات',
    all: 'جميع القنوات',
    live: 'البث المباشر',
    movies: 'الأفلام',
    series: 'المسلسلات',
  },
  settings: {
    theme: 'السمة',
    language: 'اللغة',
    darkMode: 'الوضع الداكن',
    lightMode: 'الوضع الفاتح',
    systemTheme: 'اتباع النظام',
    export: 'تصدير البيانات',
    import: 'استيراد البيانات',
    clearData: 'مسح جميع البيانات',
  },
  playlist: {
    importM3u: 'استيراد قائمة تشغيل',
    xtreamLogin: 'تسجيل دخول Xtream',
    fgCode: 'رمز FG',
    addPlaylist: 'إضافة قائمة تشغيل',
    editing: 'جارٍ التعديل...',
    parseSuccess: 'تم تحليل القائمة بنجاح',
    parseError: 'فشل تحليل القائمة',
  },
};

// English translations
const en = {
  common: {
    appName: 'ARN IPTV Pro',
    version: 'Version',
    loading: 'Loading...',
    error: 'An error occurred',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    search: 'Search...',
    noResults: 'No results found',
  },
  player: {
    volume: 'Volume',
    fullscreen: 'Fullscreen',
    pip: 'Picture-in-Picture',
    record: 'Record',
    recording: 'Recording',
    quality: 'Quality',
    audioTrack: 'Audio Track',
    buffering: 'Buffering...',
  },
  channels: {
    favorites: 'Favorites',
    history: 'Watch History',
    categories: 'Categories',
    all: 'All Channels',
    live: 'Live TV',
    movies: 'Movies',
    series: 'Series',
  },
  settings: {
    theme: 'Theme',
    language: 'Language',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    systemTheme: 'Follow System',
    export: 'Export Data',
    import: 'Import Data',
    clearData: 'Clear All Data',
  },
  playlist: {
    importM3u: 'Import Playlist',
    xtreamLogin: 'Xtream Login',
    fgCode: 'FG Code',
    addPlaylist: 'Add Playlist',
    editing: 'Editing...',
    parseSuccess: 'Playlist parsed successfully',
    parseError: 'Failed to parse playlist',
  },
};

i18n
  .use(Detector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    lng: localStorage.getItem('arn_lang') || 'ar',
    fallbackLng: 'en',
    supportedLngs: ['ar', 'en'],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
```

#### إنشاء Language Switcher Component:
```typescript
// src/components/LanguageSwitcher.tsx
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'ar', name: 'العربية', flag: '🇪🇬' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
  ];

  const changeLanguage = async (lng: string) => {
    await i18n.changeLanguage(lng);
    localStorage.setItem('arn_lang', lng);
    
    // RTL support
    document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lng;
  };

  return (
    <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
      <Globe size={16} className="text-gray-400" />
      {languages.map(lang => (
        <button
          key={lang.code}
          onClick={() => changeLanguage(lang.code)}
          className={`px-2 py-1 rounded text-sm transition-all ${
            i18n.language === lang.code
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {lang.flag} {lang.name}
        </button>
      ))}
    </div>
  );
}
```

#### تطبيق الـ translations في الأ组件:
```typescript
// App.tsx — example usage
import { useTranslation } from 'react-i18next';

function App() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-theme-primary">
      <header>
        <h1>{t('common.appName')}</h1>
        <LanguageSwitcher />
        <ThemeToggle theme={theme} onChange={setTheme} />
      </header>

      <nav>
        <button>{t('channels.favorites')}</button>
        <button>{t('channels.history')}</button>
      </nav>

      {/* ... rest of your components */}
    </div>
  );
}
```

---

### 3.3 EPG Guide (برنامج القنوات)

#### إنشاء `src/services/epgService.ts`:
```typescript
export interface EPGProgram {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  logo?: string;
  category?: string;
}

export interface EPGDay {
  date: Date;
  programs: EPGProgram[];
}

class EPGService {
  private cache: Map<string, EPGProgram[]> = new Map();
  private updateInterval: number | null = null;

  async fetchEPG(channelId: string, date: Date): Promise<EPGProgram[]> {
    const cacheKey = `${channelId}_${date.toISOString().split('T')[0]}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // Load from local catalog or XMLTV URL
      const xmlResponse = await fetch(`/api/epg/fetch?channel=${channelId}&date=${date.toISOString()}`);
      const xmlText = await xmlResponse.text();
      
      const programs = this.parseXMLTV(xmlText);
      this.cache.set(cacheKey, programs);
      
      return programs;
    } catch (error) {
      console.error('EPG fetch failed:', error);
      return [];
    }
  }

  private parseXMLTV(xmlText: string): EPGProgram[] {
    const programs: EPGProgram[] = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    
    const channels = doc.querySelectorAll('channel');
    const programmes = doc.querySelectorAll('programme');
    
    const channelMap = new Map<string, string>();
    channels.forEach(ch => {
      channelMap.set(ch.getAttribute('id')!, ch.textContent || '');
    });
    
    programmes.forEach(prog => {
      const startAttr = prog.getAttribute('start');
      const stopAttr = prog.getAttribute('stop');
      const title = prog.querySelector('title')?.textContent || '';
      const desc = prog.querySelector('desc')?.textContent || '';
      const channelRef = prog.getAttribute('channel') || '';
      
      if (startAttr && stopAttr) {
        programs.push({
          id: `${channelRef}_${startAttr}`,
          channelId: channelRef,
          title,
          description: desc || undefined,
          startDate: new Date(startAttr),
          endDate: new Date(stopAttr),
          category: prog.querySelector('category')?.textContent || undefined,
          logo: prog.querySelector('icon')?.getAttribute('src') || undefined,
        });
      }
    });
    
    return programs;
  }

  startAutoUpdate(intervalMs: number = 3600000): void { // هر ساعة
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = setInterval(() => {
      this.cache.clear(); // Invalidate cache
      // Fetch will happen again on next view
    }, intervalMs);
  }

  stopAutoUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

export const epgService = new EPGService();
```

#### إنشاء `src/components/EPGGuide.tsx`:
```typescript
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { epgService, EPGProgram } from '../services/epgService';

interface EPGGuideProps {
  channelId: string;
  channelName: string;
}

export default function EPGGuide({ channelId, channelName }: EPGGuideProps) {
  const [programs, setPrograms] = useState<EPGProgram[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEPG();
  }, [channelId, currentDate]);

  const loadEPG = async () => {
    setLoading(true);
    const data = await epgService.fetchEPG(channelId, currentDate);
    setPrograms(data);
    setLoading(false);
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const getCurrentProgram = (): EPGProgram | undefined => {
    const now = new Date();
    return programs.find(p => now >= p.startDate && now <= p.endDate);
  };

  const formatDate = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'اليوم';
    if (date.toDateString() === yesterday.toDateString()) return 'أمس';
    if (date.toDateString() === tomorrow.toDateString()) return 'غدًا';
    
    return date.toLocaleDateString('ar-EG', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('ar-EG', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const currentProg = getCurrentProgram();

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold">{channelName} — دليل البرامج</h3>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigateDay('prev')}
            className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-white min-w-[120px] text-center">
            {formatDate(currentDate)}
          </span>
          <button 
            onClick={() => navigateDay('next')}
            className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Current program highlight */}
      {currentProg && (
        <div className="mb-4 p-3 bg-blue-600/20 border border-blue-500 rounded-lg">
          <div className="flex items-center gap-2 text-blue-400 mb-1">
            <Clock size={16} />
            <span className="text-sm"> الآن</span>
          </div>
          <h4 className="text-white font-semibold">{currentProg.title}</h4>
          {currentProg.description && (
            <p className="text-gray-300 text-sm mt-1">{currentProg.description}</p>
          )}
        </div>
      )}

      {/* Programs list */}
      {loading ? (
        <div className="text-center text-gray-400 py-8">جارٍ تحميل البرنامج...</div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {programs
            .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
            .map(program => {
              const isPast = new Date() > program.endDate;
              const isCurrent = getCurrentProgram()?.id === program.id;

              return (
                <div
                  key={program.id}
                  className={`p-3 rounded-lg flex items-start gap-3 ${
                    isCurrent 
                      ? 'bg-blue-600/30 border border-blue-500' 
                      : isPast 
                        ? 'bg-gray-800/50 text-gray-500'
                        : 'bg-gray-700/50 hover:bg-gray-700'
                  }`}
                >
                  <div className="text-sm text-gray-400 min-w-[80px]">
                    {formatTime(program.startDate)} - {formatTime(program.endDate)}
                  </div>
                  <div className="flex-1">
                    <h5 className={`font-medium ${isPast ? 'line-through' : ''}`}>
                      {program.title}
                    </h5>
                    {program.category && (
                      <span className="text-xs text-gray-400 bg-gray-600 px-2 py-0.5 rounded-full">
                        {program.category}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
```

#### إضافة button لفتح الـ EPG من الـ player:
```typescript
// HlsVideoPlayer.tsx
interface Props {
  // ... existing props
  epgChannelId?: string;
  epgChannelName?: string;
}

const [showEPG, setShowEPG] = useState(false);

// في زر الـ menu:
<button onClick={() => setShowEPG(true)}>
  <Calendar size={20} />
</button>

{/* EPG Modal */}
{showEPG && props.epgChannelId && (
  <Modal onClose={() => setShowEPG(false)}>
    <EPGGuide 
      channelId={props.epgChannelId} 
      channelName={props.epgChannelName || ''} 
    />
  </Modal>
)}
```

---

## المرحلة 4: التوزيع والتحديث التلقائي 📦

### 4.1 Auto-Updater للإلكترون

#### تثبيت المكتبة:
```bash
npm install electron-updater
```

#### إنشاء `src/electron/autoUpdater.ts`:
```typescript
import { autoUpdater } from 'electron-updater';
import { ipcMain, BrowserWindow, dialog } from 'electron';

export function setupAutoUpdater(mainWindow: BrowserWindow) {
  autoUpdater.logger = require('electron');
  autoUpdater.checkForUpdatesAndNotify();

  // Progress tracking
  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow.webContents.send('update-download-progress', {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
      speed: progressObj.bytesPerSecond,
    });
  });

  // Update available
  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', info);
  });

  // Update ready to install
  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('update-downloaded', info);
    
    dialog.showMessageBox({
      type: 'info',
      title: 'تحديث جاهز',
      message: 'تم تنزيل التحديث. هل تريد التثبيت الآن وإعادة التشغيل؟',
      buttons: ['نعم، إعادة تشغيل', 'لاحقًا'],
      defaultId: 0,
    }).then(result => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  // Error handling
  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err);
    mainWindow.webContents.send('update-error', err.message);
  });

  // Handle IPC from renderer
  ipcMain.on('check-for-updates', () => {
    autoUpdater.checkForUpdates();
  });

  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall();
  });
}
```

#### Renderer-side hook:
```typescript
// src/hooks/useAutoUpdater.ts
import { useState, useEffect } from 'react';

interface UpdateInfo {
  version: string;
  releaseNotes: string;
  downloadProgress?: number;
}

export function useAutoUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    if (!window.electronAPI) return;

    const handleUpdateAvailable = (_event: any, info: any) => {
      setUpdateAvailable({
        version: info.version,
        releaseNotes: info.releaseNotes?.replace(/\\n/g, '\n') || 'لا توجد ملاحظات',
      });
    };

    const handleDownloadProgress = (_event: any, progress: any) => {
      setIsDownloading(true);
      setDownloadProgress(progress.percent);
    };

    const handleUpdateDownloaded = () => {
      setIsDownloading(false);
    };

    window.electronAPI.on('update-available', handleUpdateAvailable);
    window.electronAPI.on('update-download-progress', handleDownloadProgress);
    window.electronAPI.on('update-downloaded', handleUpdateDownloaded);

    return () => {
      window.electronAPI.removeAllListeners('update-available');
      window.electronAPI.removeAllListeners('update-download-progress');
      window.electronAPI.removeAllListeners('update-downloaded');
    };
  }, []);

  const checkForUpdates = () => {
    window.electronAPI?.send('check-for-updates');
  };

  const installUpdate = () => {
    window.electronAPI?.send('install-update');
  };

  return {
    updateAvailable,
    isDownloading,
    downloadProgress,
    checkForUpdates,
    installUpdate,
  };
}
```

#### Update Notification UI:
```typescript
// src/components/UpdateNotification.tsx
import { useAutoUpdater } from '../hooks/useAutoUpdater';
import { AlertTriangle, Download, RotateCcw } from 'lucide-react';

export default function UpdateNotification() {
  const { 
    updateAvailable, 
    isDownloading, 
    downloadProgress, 
    checkForUpdates,
    installUpdate
  } = useAutoUpdater();

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-600 text-white p-4 rounded-lg shadow-lg max-w-md z-50">
      <div className="flex items-start gap-3">
        <AlertTriangle size={24} className="shrink-0" />
        <div className="flex-1">
          <h4 className="font-bold">تحديث جديد متاح!</h4>
          <p className="text-sm mt-1">الإصدار {updateAvailable.version}</p>
          
          {isDownloading ? (
            <div className="mt-2">
              <div className="w-full bg-yellow-700 rounded-full h-2">
                <div 
                  className="bg-white rounded-full h-2 transition-all"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <p className="text-xs mt-1">{Math.round(downloadProgress)}%</p>
            </div>
          ) : (
            <div className="flex gap-2 mt-3">
              <button
                onClick={installUpdate}
                className="flex items-center gap-1 px-3 py-1.5 bg-white text-yellow-700 rounded text-sm font-medium hover:bg-yellow-50"
              >
                <RotateCcw size={14} />
                تثبيت الآن
              </button>
              <button
                onClick={checkForUpdates}
                className="px-3 py-1.5 bg-yellow-700 text-white rounded text-sm hover:bg-yellow-600"
              >
                لاحقًا
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

### 4.2 Docker Deployment

#### إنشاء `Dockerfile`:
```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY server.ts ./
COPY dist-server/ ./dist-server/

# Production stage
FROM node:20-alpine

RUN apk add --no-cache tini

WORKDIR /app

COPY --from=builder /app/dist-server/ ./dist-server/
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV BIND_ADDRESS=0.0.0.0
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist-server/server.cjs"]
```

#### إنشاء `docker-compose.yml`:
```yaml
version: '3.8'

services:
  iptv-server:
    build: .
    container_name: arn-iptv-pro
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - BIND_ADDRESS=0.0.0.0
      - PORT=3000
      # Add other env vars here
    volumes:
      - iptv-cache:/app/cache
      - iptv-logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/ping"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  iptv-cache:
  iptv-logs:
```

#### تشغيل:
```bash
docker compose up -d
```

---

### 4.3 تحسين Installer (Inno Setup)

#### تحديث `ARN-IPTV-Setup.iss`:
```ini
; Enhanced installer script

[Files]
Source: "release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "cert\ARN_Technology_Root.cer"; DestDir: "{win}\Certificates\My"; Flags: dontcopy

[Tasks]
Name: "desktopicon"; Description: "إنشاء اختصار سطح المكتب"; GroupDescription: "اختصالات:";
Name: "quicklaunchicon"; Description: "إنشاء اختصار Quick Launch"; GroupDescription: "اختصالات:";
Name: "startuplink"; Description: "تشغيل عند بدء التشغيل"; GroupDescription: "تشغيل عند بدء التشغيل:";

[Icons]
Name: "{group}\ARN IPTV Pro"; Filename: "{app}\ARN IPTV Pro.exe";
Name: "{group}\Uninstall ARN IPTV Pro"; Filename: "{uninstallexe}";
Name: "{commondesktop}\ARN IPTV Pro"; Tasks: desktopicon;
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\ARN IPTV Pro"; Tasks: quicklaunchicon;

[Run]
Filename: "{cmd}"; Parameters: "/c certutil -addstore My ""{tmp}\ARN_Technology_Root.cer"""; Flags: runhidden; StatusMsg: "تثبيت الشهادة...";
Filename: "{app}\ARN IPTV Pro.exe"; Description: "تشغيل ARN IPTV Pro"; Flags: nowait postinstall skipifsilent;

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    // Create startup registry entry if selected
    if IsTaskSelected('startuplink') then
    begin
      RegWriteStringValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', 'ARN IPTV Pro', ExpandConstant('{app}\ARN IPTV Pro.exe'));
    end;
  end;
end;
```

---

## المرحلة 5: Monitoring & Analytics 📊

### 5.1 Sentry Integration (Error Tracking)

#### تثبيت الحزم:
```bash
npm install @sentry/electron @sentry/react @sentry/tracing
```

#### إنشاء `src/lib/sentry.ts`:
```typescript
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

export function initSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      new BrowserTracing(),
    ],
    
    // Tracing
    tracesSampleRate: 0.1, // Track 10% of transactions
    
    // Session replays (optional)
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    // Environment
    environment: process.env.NODE_ENV,
    release: `arn-iptv@${process.env.npm_package_version}`,
    
    // Debugging
    debug: process.env.NODE_ENV === 'development',
    
    beforeSend: (event, hint) => {
      // Filter sensitive data before sending
      if (event.request?.cookies) {
        event.request.cookies = undefined;
      }
      if (event.user) {
        // Don't send identifiable user data
        event.user.ip_address = undefined;
      }
      return event;
    },
  });
}

// Helper for manual error reporting
export function captureException(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, {
    tags: { component: context?.component },
    extra: {
      userId: context?.userId,
      channel: context?.channel,
      timestamp: context?.timestamp,
    },
  });
}

// Helper for custom breadcrumbs
export function addBreadcrumb(message: string, category?: string) {
  Sentry.addBreadcrumb({
    message,
    category: category || 'app',
    level: 'info',
    timestamp: Date.now() / 1000,
  });
}
```

#### استخدام في الأ组件:
```typescript
// App.tsx
import { initSentry, addBreadcrumb } from './lib/sentry';

// Initialize Sentry at app start
initSentry();

// Add breadcrumb on important actions
const handleChannelSelect = (channel: ChannelItem) => {
  addBreadcrumb(`User selected channel: ${channel.name}`, 'player');
  selectChannel(channel);
};

const handlePlaylistImport = (playlist: PlaylistSource) => {
  addBreadcrumb(`Imported playlist: ${playlist.name}`, 'playlist');
  // ... rest of logic
};
```

#### Electron side (`electron-main.cjs`):
```javascript
const Sentry = require('@sentry/electron');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
});

// Catch unhandled exceptions
process.on('uncaughtException', (error) => {
  Sentry.captureException(error);
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  Sentry.captureException(new Error(`Unhandled Rejection: ${reason}`));
  console.error('Unhandled Rejection:', reason);
});
```

---

### 5.2 Log Rotation with Winston

#### تثبيت المكتبات:
```bash
npm install winston winston-daily-rotate-file
```

#### إنشاء `server/utils/logging.ts`:
```typescript
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const LOG_DIR = path.join(__dirname, '../../../logs');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${
      Object.keys(meta).length ? JSON.stringify(meta) : ''
    }`;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Info/Warn/Error to files
    new DailyRotateFile({
      filename: path.join(LOG_DIR, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '14d',
      zippedArchive: true,
    }),
    
    // Errors only to separate file
    new DailyRotateFile({
      filename: path.join(LOG_DIR, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '10m',
      maxFiles: '30d',
      zippedArchive: true,
    }),
    
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level}]: ${message}`;
        })
      ),
    }),
  ],
});

// Express request logging middleware
export function logRequest(req: express.Request, res: express.Response, next: express.NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path}`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  });
  
  next();
}

// Error handling middleware
export function errorHandler(err: Error, req: express.Request, res: express.Response, next: express.NextFunction) {
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
  });
  
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'حدث خطأ داخلي' 
      : err.message,
  });
}
```

---

### 5.3 Update Checker (للويب/النسخة المستقلة)

#### إنشاء `src/services/updateChecker.ts`:
```typescript
export interface UpdateInfo {
  version: string;
  releaseDate: string;
  changelog: string[];
  downloadUrl: string;
  forceUpdate: boolean;
}

export class UpdateChecker {
  private currentVersion: string;
  private onUpdateAvailable?: (info: UpdateInfo) => void;

  constructor(currentVersion: string) {
    this.currentVersion = currentVersion;
  }

  setOnUpdateAvailable(callback: (info: UpdateInfo) => void) {
    this.onUpdateAvailable = callback;
  }

  async checkForUpdates(): Promise<boolean> {
    try {
      // Check GitHub Releases or your server's update endpoint
      const response = await fetch('/api/update/check');
      const latest: UpdateInfo = await response.json();

      if (this.compareVersions(latest.version, this.currentVersion) > 0) {
        if (this.onUpdateAvailable) {
          this.onUpdateAvailable(latest);
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('Update check failed:', error);
      return false;
    }
  }

  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }

    return 0;
  }
}
```

#### Server Endpoint (`server.ts`):
```typescript
// Endpoint لتوفير معلومات التحديث
app.get('/api/update/check', (req, res) => {
  const currentVersion = req.query.version as string;
  
  // Check against latest published version
  const latestVersion = process.env.LATEST_VERSION || '2.6.0';
  const changelog = process.env.UPDATE_CHANGELOG?.split('|') || [];
  
  res.json({
    version: latestVersion,
    releaseDate: new Date().toISOString(),
    changelog: changelog,
    downloadUrl: 'https://github.com/user/repo/releases/latest',
    forceUpdate: false, // Set true if user MUST update
  });
});
```

#### Update Prompt Component:
```typescript
// src/components/UpdatePrompt.tsx
import { useState, useEffect } from 'react';
import { UpdateChecker } from '../services/updateChecker';
import { AlertTriangle, Download, X } from 'lucide-react';

const APP_VERSION = import.meta.env.PACKAGE_VERSION || '2.6.0';
const updateChecker = new UpdateChecker(APP_VERSION);

export default function UpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    updateChecker.setOnUpdateAvailable((info) => {
      setUpdateInfo(info);
      setShowUpdate(true);
    });

    // Check on mount and every 30 minutes
    updateChecker.checkForUpdates();
    const interval = setInterval(() => updateChecker.checkForUpdates(), 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  if (!showUpdate || !updateInfo) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-yellow-500">
            <AlertTriangle size={24} />
            <h3 className="text-xl font-bold">تحديث جديد متاح!</h3>
          </div>
          {!updateInfo.forceUpdate && (
            <button onClick={() => setShowUpdate(false)}>
              <X size={20} />
            </button>
          )}
        </div>

        <div className="mb-4">
          <p className="text-gray-300">
            الإصدار الحالي: <strong>v{APP_VERSION}</strong>
          </p>
          <p className="text-green-400">
            أحدث إصدار: <strong>v{updateInfo.version}</strong>
          </p>
        </div>

        {updateInfo.changelog.length > 0 && (
          <div className="mb-4 bg-gray-900 rounded-lg p-3 max-h-40 overflow-y-auto">
            <h4 className="font-semibold mb-2">التغييرات:</h4>
            <ul className="space-y-1 text-sm">
              {updateInfo.changelog.map((note, idx) => (
                <li key={idx} className="text-gray-400">• {note}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <a
            href={updateInfo.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download size={16} />
            تنزيل التحديث
          </a>
          {!updateInfo.forceUpdate && (
            <button
              onClick={() => setShowUpdate(false)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              لاحقًا
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 📊 جدول التنفيذ النهائي

| المرحلة | المهمة | الوقت | الأولوية | الحالة |
|---------|--------|-------|---------|--------|
| **0** | TypeScript Strict Mode | 30 دقيقة | P0 | ⬜ |
| **0** | ESLint + Prettier | 1 ساعة | P0 | ⬜ |
| **0** | إعادة تنظيم السيرفر | 2 ساعة | P1 | ⬜ |
| **1** | IndexedDB (idb-keyval) | 1.5 ساعة | P0 | ⬜ |
| **1** | Service Worker (Workbox) | 2 ساعة | P0 | ⬜ |
| **1** | Virtual Scrolling | 1.5 ساعة | P1 | ⬜ |
| **2** | Picture-in-Picture | 30 دقيقة | P1 | ⬜ |
| **2** | Video Recording | 2 ساعة | P1 | ⬜ |
| **2** | Audio Track Selector | 1 ساعة | P2 | ⬜ |
| **2** | Quality Auto-Detect | 1.5 ساعة | P2 | ⬜ |
| **3** | Dark/Light Theme | 1.5 ساعة | P1 | ⬜ |
| **3** | i18n (تعدد اللغات) | 2 ساعة | P1 | ⬜ |
| **3** | EPG Guide | 2.5 ساعة | P2 | ⬜ |
| **4** | Electron Auto-Updater | 1.5 ساعة | P0 | ⬜ |
| **4** | Docker Deployment | 1 ساعة | P2 | ⬜ |
| **4** | Installer Enhancement | 1 ساعة | P2 | ⬜ |
| **5** | Sentry Integration | 1 ساعة | P1 | ⬜ |
| **5** | Winson Logging | 1 ساعة | P1 | ⬜ |
| **5** | Update Checker | 1 ساعة | P2 | ⬜ |
| **الإجمالي** | — | **~29 ساعة** | — | — |

---

## ✅ checklist الإطلاق (v3.0.0 Release Checklist)

### Before Merge
- [ ] TypeScript compilation succeeds with zero errors
- [ ] ESLint passes with zero warnings/errors
- [ ] Prettier formatting applied to all files
- [ ] All previous security fixes are merged
- [ ] IndexedDB migration script tested with old data
- [ ] Service Worker registers correctly in dev mode

### Testing
- [ ] Test Dark/Light theme switching
- [ ] Test i18n language switching (AR/EN)
- [ ] Test PiP functionality in browser
- [ ] Test Video Recording (playback recorded file)
- [ ] Test Virtual Scrolling with 2000+ channels
- [ ] Test Auto-Update flow (simulated)
- [ ] Test Sentry error reporting
- [ ] Test EPG display with mock data
- [ ] Test Docker deployment locally
- [ ] Test Installer with all options checked

### Performance
- [ ] Lighthouse score > 80 (Performance)
- [ ] Bundle size increase < 200KB
- [ ] Memory usage stable after 30 min
- [ ] No console errors in production build

### Build & Deploy
- [ ] `npm run build` produces correct output
- [ ] `npm run electron:dist` builds installer
- [ ] Docker image builds successfully
- [ ] Sentry DSN configured
- [ ] Auto-updater config points to release server
- [ ] Version number bumped in package.json

### Documentation
- [ ] README updated with new features
- [ ] CHANGELOG.md written
- [ ] Migration guide for v2 → v3 data
- [ ] Environment variables documented
- [ ] Docker deployment instructions added

---

## 📝 ملاحظات هامة

1. **لا تنفذ كل شيء دفعة واحدة** — ركّز على Phase 0 و Phase 1 أولاً، ثم قيّم التأثير قبل المضي قدماً.

2. **Backup بيانات المستخدمين** — قبل إطلاق IndexedDB migration، تأكد من وجود backup للـ localStorage القديم.

3. ** gradual rollout** — فعّل الـ features الجديدة عبر feature flags:
   ```typescript
   const FEATURES = {
     virtualScrolling: process.env.FEATURE_VIRTUAL_SCROLL === 'true',
     pip: process.env.FEATURE_PIP === 'true',
     recording: process.env.FEATURE_RECORDING === 'true',
     epg: process.env.FEATURE_EPG === 'true',
     darkMode: process.env.FEATURE_DARK_MODE === 'true',
     i18n: process.env.FEATURE_I18N === 'true',
   };
   ```

4. **Backward Compatibility** — تأكد أن v2.6.0 يظل يشتغل حتى لو المستخدم لم يعدّش لـ v3.0.0.

5. **Test on Real Devices** — اختبر على مختلف إصدارات Windows (10/11) لأن Electron behavior يختلف شوية.
