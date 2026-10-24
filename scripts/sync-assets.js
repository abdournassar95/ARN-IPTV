#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcHls = path.join(rootDir, 'node_modules', 'hls.js', 'dist', 'hls.min.js');
const destDir = path.join(rootDir, 'src', 'renderer', 'assets', 'vendor');
const destHls = path.join(destDir, 'hls.min.js');

if (fs.existsSync(srcHls)) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(srcHls, destHls);
  console.log('[sync-assets] Copied hls.min.js -> src/renderer/assets/vendor/hls.min.js');
}
