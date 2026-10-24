'use strict';

/**
 * ARN IPTV Pro — Comprehensive Automated Verification & 50k Benchmark Suite
 * Copyright © 2026 عبده رجب نصار — شركة ARN Technology
 */

const assert = require('assert');
const axios = require('axios');

const {
  encryptPayload,
  decryptPayload,
  buildDramaPayload,
  importFgBouquet
} = require('../src/main/fg_engine');
const {
  parseM3uContent,
  buildBenchmark50kBouquet
} = require('../src/main/playlist_parser');
const {
  ArnDatabase,
  normalizeSearchText
} = require('../src/main/database');
const {
  startStreamProxy,
  resolvePlayableUrl
} = require('../src/main/stream_proxy');

async function runAllTests() {
  console.log('==============================================================');
  console.log('🧪 ARN IPTV Pro — Automated Architecture & Engine Test Suite');
  console.log('==============================================================\n');

  // 1. Test FG AES-128-CBC Encryption/Decryption Engine
  console.log('▶ [1/4] Testing FG Engine (AES-128-CBC & v187 Protocol)...');
  const samplePayload = buildDramaPayload('202122', 'sports_1');
  assert.strictEqual(samplePayload.KEY_ACTIVATED_TYPE, '202122');
  assert.strictEqual(samplePayload.version_name, '187');
  assert.strictEqual(samplePayload.topic, 'sports_1');

  const arabicData = {
    title: 'قنوات ARN الرياضية المشفرة',
    swap: { k9x_: '' },
    ok: true
  };
  const encrypted = encryptPayload(arabicData);
  assert.ok(encrypted.includes(':'), 'Encrypted payload must contain colon-separated IV');
  const decrypted = JSON.parse(decryptPayload(`"${encrypted}"`));
  assert.deepStrictEqual(decrypted, arabicData);

  const simBouquet = await importFgBouquet('ARN2026');
  assert.ok(simBouquet.categories.length >= 3, 'Simulated FG bouquet should return categories');
  assert.ok(simBouquet.channels.length >= 4, 'Simulated FG bouquet should return channels');
  console.log('   ✔ AES-128-CBC round-trip, quoted JSON unwrap & FG bouquet verified.\n');

  // 2. Test M3U / M3U8 Parser & Multi-Server Deduplication
  console.log('▶ [2/4] Testing High-Speed M3U Parser & Multi-Server Grouping...');
  const sampleM3u = [
    '#EXTM3U',
    '#EXTINF:-1 tvg-id="sp1" group-title="رياضة",ARN Sports 1 FHD [Server 1]',
    '#EXTVLCOPT:http-user-agent=CustomAgent/1.0',
    '#EXTVLCOPT:http-referrer=https://arn.example/',
    'http://stream1.example.com/live/sp1.m3u8',
    '#EXTINF:-1 tvg-id="sp1" group-title="رياضة",ARN Sports 1 FHD [Server 2]',
    'http://stream2.example.com/live/sp1_backup.m3u8',
    '#EXTINF:-1 group-title="أفلام عربية",فيلم الاختبار 1080p',
    'http://vod.example.com/movie/test1.mp4',
    '#EXTINF:-1 group-title="مسلسلات",مسلسل القمة S01E01',
    'http://vod.example.com/series/ep1.mp4',
    '#EXTINF:-1 group-title="مسلسلات",مسلسل القمة S01E02',
    'http://vod.example.com/series/ep2.mp4'
  ].join('\n');

  const parsedM3u = parseM3uContent(sampleM3u);
  assert.strictEqual(parsedM3u.channels.length, 3, 'Duplicate live servers & series episodes must be grouped');
  const liveCh = parsedM3u.channels.find((c) => c.contentType === 'live');
  assert.strictEqual(liveCh.servers.length, 2, 'Live channel should merge 2 servers');
  assert.strictEqual(liveCh.servers[0].agent, 'CustomAgent/1.0');
  assert.strictEqual(liveCh.servers[0].headers.Referer, 'https://arn.example/');

  const seriesCh = parsedM3u.channels.find((c) => c.contentType === 'series');
  assert.strictEqual(seriesCh.meta.episodes.length, 2, 'Series should contain 2 grouped episodes');
  console.log('   ✔ M3U VLC headers, Multi-Server merge & Series episode grouping verified.\n');

  // 3. Test SQLite Database + 50,000-Channel Benchmark
  console.log('▶ [3/4] Testing SQLite Engine & 50,000-Channel Stress Benchmark...');
  assert.strictEqual(
    normalizeSearchText('أبوظبي الرياضية ١'),
    normalizeSearchText('ابوظبي الرياضيه 1'),
    'Arabic smart search normalization must match'
  );

  const db = new ArnDatabase(':memory:');
  db.ensureSeeded();
  const initialStats = db.getDashboardStats();
  assert.ok(initialStats.totalItems >= 20, 'Default demo bouquet should be seeded');

  const benchData = buildBenchmark50kBouquet(50000);
  const tInsert0 = Date.now();
  const savedBench = db.saveImportedPlaylist({
    name: benchData.playlistName,
    type: 'benchmark',
    source: 'test-50k',
    categories: benchData.categories,
    channels: benchData.channels
  });
  const insertMs = Date.now() - tInsert0;

  const tSearch0 = Date.now();
  const searchRes = db.getChannels({
    playlistId: savedBench.id,
    contentType: 'live',
    search: '49999',
    limit: 50
  });
  const searchMs = Date.now() - tSearch0;

  assert.strictEqual(savedBench.channel_count, 50000);
  assert.ok(searchRes.total >= 1 && searchRes.items[0].name.includes('49999'));

  const favToggle = db.toggleFavorite(searchRes.items[0].id, true);
  assert.strictEqual(favToggle.isFavorite, true);
  db.recordPlayback(searchRes.items[0].id, 42.5);
  const reloadedCh = db.getChannelById(searchRes.items[0].id);
  assert.strictEqual(reloadedCh.lastPosition, 42.5);
  assert.strictEqual(reloadedCh.playCount, 1);
  db.close();

  console.log(
    `   ✔ SQLite (${initialStats.engine}) inserted 50,000 channels in ${insertMs}ms & searched in ${searchMs}ms.\n`
  );

  // 4. Test Local Stream Proxy, k9x_ Swap Removal & MPEG-TS Streaming
  console.log('▶ [4/4] Testing Local Stream Proxy, k9x_ Swap & Adaptive HLS...');
  const proxyInfo = await startStreamProxy(0);
  try {
    // 4a. /ping + CORS check
    const pingResp = await axios.get(`${proxyInfo.baseUrl}/ping`);
    assert.strictEqual(pingResp.status, 200);
    assert.strictEqual(pingResp.data, 'pong');
    assert.strictEqual(pingResp.headers['access-control-allow-origin'], '*');

    // 4b. End-to-End FG Encrypted Stream + k9x_ Swap Removal
    const playableFgUrl = resolvePlayableUrl(
      'fg://arn_fg_101?code=ARN2026&srv=0',
      {},
      '',
      proxyInfo.baseUrl
    );
    const masterResp = await axios.get(playableFgUrl, { responseType: 'text' });
    assert.strictEqual(masterResp.status, 200);
    const subplaylistLine = masterResp.data
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.includes('/subplaylist?'));
    assert.ok(subplaylistLine, 'Master M3U8 must rewrite variant M3U8 to /subplaylist');

    const variantResp = await axios.get(subplaylistLine, { responseType: 'text' });
    assert.strictEqual(variantResp.status, 200);
    assert.ok(
      !variantResp.data.includes('k9x_'),
      'k9x_ obfuscation prefix MUST be stripped from variant playlist'
    );

    const tsLine = variantResp.data
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.includes('/ts?'));
    assert.ok(tsLine, 'Variant M3U8 must rewrite TS segments to /ts');

    const tsResp = await axios.get(tsLine, { responseType: 'arraybuffer' });
    assert.strictEqual(tsResp.status, 200);
    const tsBuf = Buffer.from(tsResp.data);
    assert.ok(tsBuf.length > 1000, 'TS segment should contain real video payload');
    assert.strictEqual(tsBuf[0], 0x47, 'First byte of TS segment must be MPEG-TS sync byte 0x47');

    // 4c. Auto-Failover Simulated 503 Endpoint check
    const failResp = await axios.get(`${proxyInfo.baseUrl}/demo/fail/server1_down`, {
      validateStatus: () => true
    });
    assert.strictEqual(failResp.status, 503);

    console.log('   ✔ Proxy /ping, CORS, FG k9x_ removal, /subplaylist & real 0x47 MPEG-TS verified.\n');
  } finally {
    proxyInfo.server.close();
  }

  console.log('✅ ALL TESTS PASSED SUCCESSFULLY!');
}

runAllTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
