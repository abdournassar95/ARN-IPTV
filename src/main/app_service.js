'use strict';

/**
 * ARN IPTV Pro — Unified Application Service Layer
 * Copyright © 2026 عبده رجب نصار — شركة ARN Technology
 *
 * Powers both Electron Main Process IPC (`main.js`) and Web Preview Server (`web_preview.js`).
 */

const { ArnDatabase } = require('./database');
const { importFgBouquet } = require('./fg_engine');
const {
  parseM3uContent,
  importM3uUrl,
  importM3uFile,
  importXtreamAccount,
  buildDefaultDemoBouquet,
  buildBenchmark50kBouquet
} = require('./playlist_parser');
const { resolvePlayableUrl, clearStreamCache } = require('./stream_proxy');

class ArnAppService {
  /**
   * @param {{ dbPath: string, getProxyBase: (reqCtx?: any) => string }} options
   */
  constructor({ dbPath, getProxyBase }) {
    this.db = new ArnDatabase(dbPath);
    this.db.ensureSeeded();
    this.getProxyBase = getProxyBase || (() => 'http://127.0.0.1:39871');
  }

  /**
   * Decorates channel objects with resolved `playableUrl` and `playableServers`
   * bound to the active stream proxy base URL.
   */
  decorateChannelUrls(channel, reqCtx = null) {
    if (!channel) return null;
    const proxyBase = this.getProxyBase(reqCtx);
    const rawServers = Array.isArray(channel.servers) && channel.servers.length > 0
      ? channel.servers
      : [{ name: 'سيرفر 1 (الرئيسي)', url: channel.streamUrl, headers: channel.headers }];

    const playableServers = rawServers.map((srv, idx) => ({
      name: srv.name || (idx === 0 ? 'سيرفر 1 (الرئيسي)' : `سيرفر ${idx + 1} (احتياطي)`),
      rawUrl: srv.url,
      url: resolvePlayableUrl(
        srv.url,
        srv.headers || channel.headers || {},
        srv.agent || '',
        proxyBase
      )
    }));

    // Hydrate series episodes if present
    let meta = channel.meta;
    if (meta && Array.isArray(meta.episodes)) {
      meta = {
        ...meta,
        episodes: meta.episodes.map((ep) => ({
          ...ep,
          rawUrl: ep.url,
          url: resolvePlayableUrl(ep.url, ep.headers || channel.headers || {}, ep.agent || '', proxyBase)
        }))
      };
    }

    return {
      ...channel,
      meta,
      url: playableServers[0]?.url || resolvePlayableUrl(channel.streamUrl, channel.headers, '', proxyBase),
      sources: playableServers
    };
  }

  getAppStatus(reqCtx = null) {
    return {
      appName: 'ARN IPTV Pro',
      version: '2.0.0',
      owner: 'عبده رجب نصار — شركة ARN Technology © 2026',
      proxyBase: this.getProxyBase(reqCtx),
      stats: this.db.getDashboardStats(),
      settings: this.db.getSettings()
    };
  }

  getPlaylists() {
    return this.db.getPlaylists();
  }

  setActivePlaylist(playlistId) {
    clearStreamCache();
    return this.db.setActivePlaylist(playlistId);
  }

  deletePlaylist(playlistId) {
    clearStreamCache();
    return this.db.deletePlaylist(playlistId);
  }

  getCategories(input = {}) {
    if (typeof input === 'number' || typeof input === 'string') {
      return this.db.getCategories({ playlistId: Number(input), contentType: 'live' });
    }
    return this.db.getCategories(input || {});
  }

  getChannels(filter = {}, reqCtx = null) {
    const res = this.db.getChannels(filter || {});
    return {
      total: res.total,
      items: res.items.map((ch) => this.decorateChannelUrls(ch, reqCtx))
    };
  }

  getChannelById(channelId, reqCtx = null) {
    const ch = this.db.getChannelById(channelId);
    return this.decorateChannelUrls(ch, reqCtx);
  }

  toggleFavorite(channelId, isFav = null) {
    return this.db.toggleFavorite(channelId, isFav);
  }

  recordPlayback(channelId, positionSec = null) {
    return this.db.recordPlayback(channelId, positionSec);
  }

  savePlaybackPosition(channelId, positionSec = 0) {
    return this.db.savePlaybackPosition(channelId, positionSec);
  }

  clearHistory() {
    return this.db.clearHistory();
  }

  getSettings() {
    return this.db.getSettings();
  }

  setSetting(key, value) {
    return this.db.setSetting(key, value);
  }

  async importFgCode(code, onProgress = () => {}) {
    const bouquet = await importFgBouquet(code, onProgress);
    const saved = this.db.saveImportedPlaylist({
      name: bouquet.playlistName,
      type: 'fg',
      source: String(code).trim(),
      categories: bouquet.categories,
      channels: bouquet.channels
    });
    return { playlist: saved, importedCount: bouquet.channels.length };
  }

  async importM3uFromUrl({ name, url, userAgent }, onProgress = () => {}) {
    const parsed = await importM3uUrl(url, { userAgent }, onProgress);
    const saved = this.db.saveImportedPlaylist({
      name: name || `قائمة M3U (${new URL(url).hostname})`,
      type: 'm3u_url',
      source: url,
      credentials: userAgent ? { userAgent } : {},
      categories: parsed.categories,
      channels: parsed.channels
    });
    return { playlist: saved, importedCount: parsed.channels.length };
  }

  importM3uFromFile({ name, filePath }, onProgress = () => {}) {
    const parsed = importM3uFile(filePath, {}, onProgress);
    const saved = this.db.saveImportedPlaylist({
      name: name || 'قائمة M3U محلية',
      type: 'm3u_file',
      source: filePath,
      categories: parsed.categories,
      channels: parsed.channels
    });
    return { playlist: saved, importedCount: parsed.channels.length };
  }

  importM3uFromText({ name, content }, onProgress = () => {}) {
    onProgress({ percent: 35, message: 'جاري قراءة وتحليل نص M3U...' });
    const parsed = parseM3uContent(content || '');
    if (parsed.channels.length === 0) {
      throw new Error('لم يتم العثور على أي قنوات صالحة في النص المدخل');
    }
    onProgress({ percent: 80, message: `جاري حفظ ${parsed.channels.length} عنصر في قاعدة البيانات...` });
    const saved = this.db.saveImportedPlaylist({
      name: name || 'قائمة M3U مخصصة',
      type: 'm3u_text',
      source: 'inline-m3u',
      categories: parsed.categories,
      channels: parsed.channels
    });
    onProgress({ percent: 100, message: 'اكتمل الحفظ بنجاح' });
    return { playlist: saved, importedCount: parsed.channels.length };
  }

  async importXtream({ name, host, username, password }, onProgress = () => {}) {
    const parsed = await importXtreamAccount({ host, username, password }, onProgress);
    if (parsed.channels.length === 0) {
      throw new Error('لم يُرجع خادم Xtream أي قنوات أو محتوى');
    }
    const saved = this.db.saveImportedPlaylist({
      name: name || `Xtream (${username})`,
      type: 'xtream',
      source: host,
      credentials: { host, username, password },
      categories: parsed.categories,
      channels: parsed.channels
    });
    return { playlist: saved, importedCount: parsed.channels.length };
  }

  seedDemoBouquet() {
    const demo = buildDefaultDemoBouquet();
    const saved = this.db.saveImportedPlaylist({
      name: demo.playlistName,
      type: 'demo',
      source: 'ARN-Showcase-v2',
      categories: demo.categories,
      channels: demo.channels
    });
    return { playlist: saved, importedCount: demo.channels.length };
  }

  run50kBenchmark(count = 50000, onProgress = () => {}) {
    const safeCount = Math.max(1000, Math.min(60000, Number(count) || 50000));
    onProgress({ percent: 20, message: `جاري توليد ${safeCount.toLocaleString('en-US')} قناة اختبارية...` });
    const t0 = Date.now();
    const bouquet = buildBenchmark50kBouquet(safeCount);
    const genMs = Date.now() - t0;

    onProgress({ percent: 55, message: 'جاري الإدراج المتزامن في SQLite عبر Transaction واحدة...' });
    const t1 = Date.now();
    const saved = this.db.saveImportedPlaylist({
      name: bouquet.playlistName,
      type: 'benchmark',
      source: `benchmark-${safeCount}`,
      categories: bouquet.categories,
      channels: bouquet.channels
    });
    const insertMs = Date.now() - t1;

    const t2 = Date.now();
    const searchCheck = this.db.getChannels({
      playlistId: saved.id,
      contentType: 'live',
      search: '49999',
      limit: 50
    });
    const queryMs = Date.now() - t2;

    onProgress({
      percent: 100,
      message: `تم إدراج ${safeCount.toLocaleString('en-US')} قناة في ${insertMs}ms واستعلام البحث في ${queryMs}ms!`
    });

    return {
      playlist: saved,
      importedCount: safeCount,
      metrics: {
        generateMs: genMs,
        sqliteInsertMs: insertMs,
        indexedSearchMs: queryMs,
        matchedRows: searchCheck.total
      }
    };
  }

  close() {
    this.db.close();
  }
}

module.exports = { ArnAppService };
