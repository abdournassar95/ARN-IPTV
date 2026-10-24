'use strict';

/**
 * ARN IPTV Pro — Interactive HLS.js GPU Player, Multi-Server Failover & 200% Audio Boost Engine
 * Copyright © 2026 عبده رجب نصار — شركة ARN Technology
 */

class ArnVideoPlayer {
  constructor({ onPrevChannel, onNextChannel, onToast }) {
    this.onPrevChannel = onPrevChannel;
    this.onNextChannel = onNextChannel;
    this.onToast = onToast || (() => {});

    // DOM References
    this.wrapper = document.getElementById('videoWrapper');
    this.video = document.getElementById('videoPlayer');
    this.idleOverlay = document.getElementById('playerIdleOverlay');
    this.spinner = document.getElementById('loadingSpinner');
    this.spinnerText = document.getElementById('spinnerText');
    this.btnRetryStream = document.getElementById('btnRetryStream');
    this.bannerToast = document.getElementById('playerBannerToast');

    this.livePulseDot = document.getElementById('livePulseDot');
    this.nowPlayingTitle = document.getElementById('nowPlayingTitle');
    this.nowPlayingGroup = document.getElementById('nowPlayingGroup');
    this.nowPlayingEpg = document.getElementById('nowPlayingEpg');
    this.streamTechBadge = document.getElementById('streamTechBadge');
    this.techResText = document.getElementById('techResText');
    this.techBitrateText = document.getElementById('techBitrateText');

    this.serverSelect = document.getElementById('serverSelect');
    this.qualitySelect = document.getElementById('qualitySelect');
    this.audioTrackSelect = document.getElementById('audioTrackSelect');
    this.aspectRatioSelect = document.getElementById('aspectRatioSelect');

    this.btnPlayPause = document.getElementById('btnPlayPause');
    this.btnReloadStream = document.getElementById('btnReloadStream');
    this.btnPrev = document.getElementById('btnPrevChannel');
    this.btnNext = document.getElementById('btnNextChannel');
    this.btnMute = document.getElementById('btnMute');
    this.volSlider = document.getElementById('volSlider');
    this.volLabel = document.getElementById('volLabel');

    this.volumeOverlay = document.getElementById('volumeOverlay');
    this.volOverlayIcon = document.getElementById('volOverlayIcon');
    this.volOverlayText = document.getElementById('volOverlayText');
    this.volBoostTag = document.getElementById('volBoostTag');
    this.volBarFill = document.getElementById('volBarFill');

    this.vodTimelineBar = document.getElementById('vodTimelineBar');
    this.vodCurrentTime = document.getElementById('vodCurrentTime');
    this.vodSeekSlider = document.getElementById('vodSeekSlider');
    this.vodDuration = document.getElementById('vodDuration');

    this.btnFullscreen = document.getElementById('btnFullscreen');
    this.btnPip = document.getElementById('btnPip');
    this.btnSnapshot = document.getElementById('btnSnapshot');

    // State
    this.hls = null;
    this.currentChannel = null;
    this.sources = [];
    this.currentServerIdx = 0;
    this.failedServers = new Set();
    this.mediaErrorRecovered = false;

    this.currentVolume = 100;
    this.lastNonZeroVolume = 100;
    this.isMuted = false;
    this.audioCtx = null;
    this.mediaSource = null;
    this.gainNode = null;

    this.autoFailover = true;
    this.rememberPosition = true;
    this.bufferProfile = 'balanced';

    this._overlayTimer = null;
    this._bannerTimer = null;
    this._posSaveTimer = null;
    this._isSeeking = false;

    this._bindEvents();
  }

  applySettings(settings = {}) {
    if (settings.autoFailover !== undefined) {
      this.autoFailover = String(settings.autoFailover) !== 'false';
    }
    if (settings.rememberPosition !== undefined) {
      this.rememberPosition = String(settings.rememberPosition) !== 'false';
    }
    if (settings.bufferProfile) {
      this.bufferProfile = settings.bufferProfile;
    }
    if (settings.defaultVolume !== undefined) {
      const vol = parseInt(settings.defaultVolume, 10);
      if (!isNaN(vol)) {
        this.setVolume(vol, { showOsd: false, persist: false });
      }
    }
  }

  _setupAudioContext() {
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioContextCls = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCls) return;
      this.audioCtx = new AudioContextCls();
      this.mediaSource = this.audioCtx.createMediaElementSource(this.video);
      this.gainNode = this.audioCtx.createGain();
      this.mediaSource.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);
    } catch (err) {
      console.warn('[Player] AudioContext init skipped:', err.message);
    }
  }

  _bindEvents() {
    // Play / Pause
    this.btnPlayPause.addEventListener('click', () => this.togglePlayPause());
    this.video.addEventListener('play', () => {
      this.btnPlayPause.textContent = '⏸';
      this.livePulseDot.classList.remove('idle');
    });
    this.video.addEventListener('pause', () => {
      this.btnPlayPause.textContent = '▶';
    });
    this.video.addEventListener('playing', () => {
      this._hideSpinner();
    });
    this.video.addEventListener('waiting', () => {
      if (this.currentChannel) {
        this._showSpinner('جاري تخزين البث مؤقتاً...');
      }
    });

    // Reload & Retry
    this.btnReloadStream.addEventListener('click', () => this.reloadCurrentStream());
    this.btnRetryStream.addEventListener('click', () => {
      this.failedServers.clear();
      this.playServerIndex(this.currentServerIdx);
    });

    // Prev / Next Channel
    this.btnPrev.addEventListener('click', () => this.onPrevChannel && this.onPrevChannel());
    this.btnNext.addEventListener('click', () => this.onNextChannel && this.onNextChannel());

    // Mute & Volume Slider (0% -> 200%)
    this.btnMute.addEventListener('click', () => this.toggleMute());
    this.volSlider.addEventListener('input', () => {
      this.setVolume(parseInt(this.volSlider.value, 10), { showOsd: true });
    });

    // Mouse Wheel Volume & 200% Boost Gesture
    this.wrapper.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const step = 5;
        if (e.deltaY < 0) {
          this.setVolume(this.currentVolume + step, { showOsd: true });
        } else {
          this.setVolume(this.currentVolume - step, { showOsd: true });
        }
      },
      { passive: false }
    );

    // Double-Click Fullscreen Gesture
    this.wrapper.addEventListener('dblclick', (e) => {
      if (
        e.target.closest('.osd-bar') ||
        e.target.closest('.player-header') ||
        e.target.closest('button')
      ) {
        return;
      }
      this.toggleFullscreen();
    });

    // Single click on video toggles play/pause (optional subtle desktop UX)
    this.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());
    this.btnPip.addEventListener('click', () => this.togglePip());
    this.btnSnapshot.addEventListener('click', () => this.takeSnapshot());

    // Aspect Ratio Switcher
    this.aspectRatioSelect.addEventListener('change', () => {
      this.setAspectRatio(this.aspectRatioSelect.value);
    });

    // Server Selector Manual Switch
    this.serverSelect.addEventListener('change', () => {
      const idx = parseInt(this.serverSelect.value, 10) || 0;
      this.failedServers.clear();
      this.playServerIndex(idx);
    });

    // Quality Selector
    this.qualitySelect.addEventListener('change', () => {
      const lvl = parseInt(this.qualitySelect.value, 10);
      if (this.hls) {
        this.hls.currentLevel = lvl;
        const label = this.qualitySelect.options[this.qualitySelect.selectedIndex]?.textContent || '';
        this.showBanner(`🎬 تم ضبط الجودة: ${label.replace('🎬 ', '')}`);
      }
    });

    // Audio Track Selector
    this.audioTrackSelect.addEventListener('change', () => {
      const trackIdx = parseInt(this.audioTrackSelect.value, 10);
      if (this.hls && !isNaN(trackIdx)) {
        this.hls.audioTrack = trackIdx;
        this.showBanner('🎙️ تم تغيير مسار الصوت');
      }
    });

    // VOD Seekbar Events
    this.video.addEventListener('timeupdate', () => this._onTimeUpdate());
    this.video.addEventListener('loadedmetadata', () => this._onLoadedMetadata());
    this.vodSeekSlider.addEventListener('mousedown', () => {
      this._isSeeking = true;
    });
    this.vodSeekSlider.addEventListener('change', () => {
      if (this.video.duration && isFinite(this.video.duration)) {
        const pct = Number(this.vodSeekSlider.value) / 1000;
        this.video.currentTime = pct * this.video.duration;
      }
      this._isSeeking = false;
    });
    this.vodSeekSlider.addEventListener('input', () => {
      if (this.video.duration && isFinite(this.video.duration)) {
        const pct = Number(this.vodSeekSlider.value) / 1000;
        this.vodCurrentTime.textContent = this._formatTime(pct * this.video.duration);
      }
    });
  }

  /**
   * Loads a channel/movie/episode and populates multi-server options.
   */
  loadChannel(channel, customEpisode = null) {
    if (!channel) return;
    this.currentChannel = channel;
    this.failedServers.clear();
    this.idleOverlay.classList.add('hidden');

    const displayTitle = customEpisode
      ? `${channel.name} — ${customEpisode.title}`
      : channel.name;

    this.nowPlayingTitle.textContent = displayTitle;
    this.nowPlayingGroup.textContent = channel.groupTitle || 'بث مباشر';
    this.nowPlayingEpg.textContent =
      channel.meta?.epgNow ||
      channel.meta?.plot ||
      (channel.contentType === 'movie'
        ? `فيلم ${channel.meta?.year || ''} ${channel.meta?.rating ? `• تقييم ⭐ ${channel.meta.rating}` : ''}`
        : 'بث نشط عبر محرك البروكسي المحلي');

    // Populate #serverSelect
    if (customEpisode) {
      this.sources = [{ name: customEpisode.title, url: customEpisode.url }];
    } else if (Array.isArray(channel.sources) && channel.sources.length > 0) {
      this.sources = channel.sources;
    } else {
      this.sources = [{ name: 'سيرفر 1 (الرئيسي)', url: channel.url || channel.streamUrl }];
    }

    this.serverSelect.innerHTML = '';
    this.sources.forEach((src, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = src.name || `سيرفر ${idx + 1}`;
      this.serverSelect.appendChild(opt);
    });

    // Record watch history
    window.api.recordPlayback(channel.id).catch(() => {});

    this.playServerIndex(0);
  }

  _buildHlsConfig() {
    const base = {
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 30
    };
    if (this.bufferProfile === 'low-latency') {
      return {
        ...base,
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        manifestLoadingMaxRetry: 1,
        levelLoadingMaxRetry: 1,
        fragLoadingMaxRetry: 2
      };
    }
    if (this.bufferProfile === 'stable') {
      return {
        ...base,
        maxBufferLength: 45,
        maxMaxBufferLength: 90,
        manifestLoadingMaxRetry: 3,
        levelLoadingMaxRetry: 3,
        fragLoadingMaxRetry: 4
      };
    }
    // balanced
    return {
      ...base,
      maxBufferLength: 24,
      maxMaxBufferLength: 48,
      manifestLoadingMaxRetry: 1,
      levelLoadingMaxRetry: 2,
      fragLoadingMaxRetry: 2
    };
  }

  playServerIndex(serverIdx) {
    if (!this.sources || this.sources.length === 0) return;
    const boundedIdx = Math.max(0, Math.min(this.sources.length - 1, serverIdx));
    this.currentServerIdx = boundedIdx;
    this.serverSelect.value = String(boundedIdx);
    this.mediaErrorRecovered = false;

    const targetSource = this.sources[boundedIdx];
    if (!targetSource || !targetSource.url) {
      this._handleStreamFailure('رابط البث غير متوفر لهذا السيرفر');
      return;
    }

    this._playStreamUrl(targetSource.url, targetSource.name);
  }

  _destroyHls() {
    if (this._posSaveTimer) {
      clearInterval(this._posSaveTimer);
      this._posSaveTimer = null;
    }
    if (this.hls) {
      try {
        this.hls.destroy();
      } catch (_e) {}
      this.hls = null;
    }
    this.video.removeAttribute('src');
    this.video.load();
  }

  _playStreamUrl(streamUrl, serverName = '') {
    this._destroyHls();

    this._showSpinner(`جاري الاتصال بـ ${serverName || 'السيرفر'}...`);
    this.btnRetryStream.classList.add('hidden');
    this.streamTechBadge.classList.add('hidden');
    this.audioTrackSelect.classList.add('hidden');
    this.qualitySelect.innerHTML = '<option value="-1">🎬 الجودة: تلقائي (Auto)</option>';

    const isDirectVideo =
      streamUrl.includes('/direct?') ||
      /\.(mp4|mkv|webm|ogg)(\?|$)/i.test(streamUrl);

    if (!isDirectVideo && window.Hls && window.Hls.isSupported()) {
      const hls = new window.Hls(this._buildHlsConfig());
      this.hls = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(this.video);

      hls.on(window.Hls.Events.MANIFEST_PARSED, (_event, data) => {
        this._populateQualityLevels(data.levels || []);
        this._hideSpinner();
        this._resumePositionIfApplicable();
        this._applyCurrentAudioGain();
        this.video.play().catch(() => {});
      });

      hls.on(window.Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        const lvl = hls.levels?.[data.level];
        if (lvl) {
          const h = lvl.height || 0;
          const kbps = lvl.bitrate ? Math.round(lvl.bitrate / 1000) : 0;
          const resTag = h >= 2160 ? '4K UHD' : h >= 1080 ? '1080p FHD' : h >= 720 ? '720p HD' : h ? `${h}p` : 'HLS';
          this.techResText.textContent = resTag;
          this.techBitrateText.textContent = kbps ? `${kbps} kbps` : 'Auto';
          this.streamTechBadge.classList.remove('hidden');
        }
      });

      hls.on(window.Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
        const tracks = data?.audioTracks || [];
        if (tracks.length > 1) {
          this.audioTrackSelect.innerHTML = '';
          tracks.forEach((tr, idx) => {
            const opt = document.createElement('option');
            opt.value = String(idx);
            opt.textContent = `🎙️ ${tr.name || tr.lang || `مسار صوت ${idx + 1}`}`;
            this.audioTrackSelect.appendChild(opt);
          });
          this.audioTrackSelect.classList.remove('hidden');
        } else {
          this.audioTrackSelect.classList.add('hidden');
        }
      });

      hls.on(window.Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;

        if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR && !this.mediaErrorRecovered) {
          this.mediaErrorRecovered = true;
          hls.recoverMediaError();
          return;
        }

        this._handleStreamFailure(
          data.details ? `تعذر تحميل التدفق (${data.details})` : 'انقطع الاتصال بخادم البث'
        );
      });
    } else {
      // Native HTML5 playback (Direct MP4/TS or Safari native HLS)
      this.video.src = streamUrl;
      this.video.onloadeddata = () => {
        this._hideSpinner();
        this._resumePositionIfApplicable();
        this._applyCurrentAudioGain();
        this.video.play().catch(() => {});
      };
      this.video.onerror = () => {
        this._handleStreamFailure('تعذر تشغيل مصدر الفيديو المباشر');
      };
    }

    // Periodic VOD position persistence
    this._posSaveTimer = setInterval(() => {
      if (
        this.currentChannel &&
        this.currentChannel.contentType !== 'live' &&
        !this.video.paused &&
        this.video.currentTime > 3
      ) {
        window.api.savePlaybackPosition(this.currentChannel.id, this.video.currentTime).catch(() => {});
      }
    }, 5000);
  }

  _populateQualityLevels(levels) {
    this.qualitySelect.innerHTML = '<option value="-1">🎬 الجودة: تلقائي (Auto)</option>';
    levels.forEach((level, index) => {
      const height = level.height || 0;
      const kbps = level.bitrate ? Math.round(level.bitrate / 1000) : 0;
      let label = height ? `${height}p` : `مستوى ${index + 1}`;
      if (height >= 2160) label = `4K UHD (${height}p)`;
      else if (height >= 1080) label = `FHD 1080p (${kbps} kbps)`;
      else if (height >= 720) label = `HD 720p (${kbps} kbps)`;
      else if (height >= 480) label = `SD 480p (${kbps} kbps)`;
      else if (height > 0) label = `${height}p (${kbps} kbps)`;

      const opt = document.createElement('option');
      opt.value = String(index);
      opt.textContent = `🎬 ${label}`;
      this.qualitySelect.appendChild(opt);
    });
  }

  /**
   * Handles stream error with automatic multi-server failover (`Auto-Failover`).
   */
  _handleStreamFailure(reason) {
    this.failedServers.add(this.currentServerIdx);

    if (this.autoFailover && this.sources.length > 1) {
      let nextIdx = -1;
      for (let offset = 1; offset < this.sources.length; offset++) {
        const candidate = (this.currentServerIdx + offset) % this.sources.length;
        if (!this.failedServers.has(candidate)) {
          nextIdx = candidate;
          break;
        }
      }

      if (nextIdx !== -1) {
        const failedName = this.sources[this.currentServerIdx]?.name || `سيرفر ${this.currentServerIdx + 1}`;
        const nextName = this.sources[nextIdx]?.name || `سيرفر ${nextIdx + 1}`;
        this.showBanner(`⚡ تعذر الاتصال بـ "${failedName}" — التحويل التلقائي إلى "${nextName}"`);
        this.onToast(`تحويل تلقائي (Auto-Failover): الانتقال إلى ${nextName}`, 'warn');
        this.playServerIndex(nextIdx);
        return;
      }
    }

    // All servers failed
    this.spinner.classList.remove('hidden');
    this.spinnerText.textContent = `⚠️ ${reason}`;
    this.btnRetryStream.classList.remove('hidden');
    this.livePulseDot.classList.add('idle');
  }

  _resumePositionIfApplicable() {
    if (
      this.rememberPosition &&
      this.currentChannel &&
      this.currentChannel.contentType !== 'live' &&
      this.currentChannel.lastPosition > 5
    ) {
      const targetPos = this.currentChannel.lastPosition;
      if (!this.video.duration || targetPos < this.video.duration - 5) {
        this.video.currentTime = targetPos;
        this.showBanner(`⏱️ تم استئناف المشاهدة من ${this._formatTime(targetPos)}`);
      }
    }
  }

  _onLoadedMetadata() {
    const dur = this.video.duration;
    const isVod =
      this.currentChannel &&
      this.currentChannel.contentType !== 'live' &&
      dur &&
      isFinite(dur) &&
      dur > 0;

    if (isVod) {
      this.vodTimelineBar.classList.remove('hidden');
      this.vodDuration.textContent = this._formatTime(dur);
    } else {
      this.vodTimelineBar.classList.add('hidden');
    }
  }

  _onTimeUpdate() {
    if (this._isSeeking || this.vodTimelineBar.classList.contains('hidden')) return;
    const dur = this.video.duration;
    if (dur && isFinite(dur) && dur > 0) {
      const cur = this.video.currentTime || 0;
      this.vodCurrentTime.textContent = this._formatTime(cur);
      this.vodDuration.textContent = this._formatTime(dur);
      this.vodSeekSlider.value = String(Math.round((cur / dur) * 1000));
    }
  }

  _formatTime(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }

  reloadCurrentStream() {
    if (!this.currentChannel) return;
    this.showBanner('↻ جاري إعادة تنشيط البث...');
    this.playServerIndex(this.currentServerIdx);
  }

  togglePlayPause() {
    if (!this.currentChannel) return;
    if (this.video.paused) {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      this.video.play().catch(() => {});
    } else {
      this.video.pause();
    }
  }

  seekBy(deltaSeconds) {
    if (!this.currentChannel) return;
    try {
      const next = Math.max(0, (this.video.currentTime || 0) + deltaSeconds);
      this.video.currentTime = next;
      this.showBanner(`${deltaSeconds > 0 ? '⏩ +' : '⏪ '}${deltaSeconds} ثانية`);
    } catch (_e) {}
  }

  _applyCurrentAudioGain() {
    if (this.isMuted || this.currentVolume === 0) {
      this.video.muted = true;
      return;
    }
    this.video.muted = false;
    if (this.currentVolume <= 100) {
      this.video.volume = this.currentVolume / 100;
      if (this.gainNode) this.gainNode.gain.value = 1.0;
    } else {
      this._setupAudioContext();
      this.video.volume = 1.0;
      if (this.gainNode) {
        this.gainNode.gain.value = this.currentVolume / 100; // Up to 2.0x boost!
      }
    }
  }

  /**
   * Sets volume from 0% to 200% with Web Audio API GainNode boost above 100%.
   */
  setVolume(val, { showOsd = true, persist = true } = {}) {
    const clamped = Math.max(0, Math.min(200, Math.round(val)));
    this.currentVolume = clamped;
    if (clamped > 0) {
      this.isMuted = false;
      this.lastNonZeroVolume = clamped;
    } else {
      this.isMuted = true;
    }

    this._applyCurrentAudioGain();

    this.volSlider.value = String(clamped);
    this.volLabel.textContent = `${clamped}%`;
    this.volLabel.style.color = clamped > 100 ? '#fbbf24' : '#10b981';
    this.btnMute.textContent = clamped === 0 ? '🔇' : clamped > 100 ? '🔊' : '🔉';

    if (showOsd) {
      this._showVolumeOverlay(clamped);
    }

    if (persist && window.api) {
      window.api.setSetting('defaultVolume', String(clamped)).catch(() => {});
    }
  }

  toggleMute() {
    if (this.isMuted || this.currentVolume === 0) {
      this.setVolume(this.lastNonZeroVolume || 100, { showOsd: true });
    } else {
      this.lastNonZeroVolume = this.currentVolume;
      this.setVolume(0, { showOsd: true, persist: false });
    }
  }

  _showVolumeOverlay(vol) {
    this.volOverlayIcon.textContent = vol === 0 ? '🔇' : vol > 100 ? '🔊' : '🔉';
    this.volOverlayText.textContent = `${vol}%`;
    this.volBoostTag.classList.toggle('hidden', vol <= 100);
    this.volBarFill.style.width = `${(vol / 200) * 100}%`;
    this.volBarFill.classList.toggle('boosted', vol > 100);

    this.volumeOverlay.classList.remove('hidden');
    clearTimeout(this._overlayTimer);
    this._overlayTimer = setTimeout(() => {
      this.volumeOverlay.classList.add('hidden');
    }, 1200);
  }

  setAspectRatio(mode) {
    this.video.classList.remove('ratio-16-9', 'ratio-4-3', 'ratio-21-9', 'ratio-fill');
    if (mode === '16:9') this.video.classList.add('ratio-16-9');
    else if (mode === '4:3') this.video.classList.add('ratio-4-3');
    else if (mode === '21:9') this.video.classList.add('ratio-21-9');
    else if (mode === 'fill') this.video.classList.add('ratio-fill');
    this.showBanner(`📐 الأبعاد: ${mode === 'default' ? 'تلقائية' : mode}`);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.wrapper.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  async togglePip() {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (this.video.readyState >= 2 && this.video.requestPictureInPicture) {
        await this.video.requestPictureInPicture();
      } else {
        this.onToast('شغّل قناة أولاً لتفعيل وضع صورة داخل صورة', 'warn');
      }
    } catch (_err) {
      this.onToast('وضع صورة داخل صورة غير متاح حالياً', 'warn');
    }
  }

  takeSnapshot() {
    if (!this.video.videoWidth || !this.video.videoHeight) {
      this.onToast('لا يوجد إطار فيديو نشط لالتقاطه حالياً', 'warn');
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = this.video.videoWidth;
      canvas.height = this.video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `ARN-IPTV-Snapshot-${Date.now()}.png`;
      a.click();
      this.showBanner('📷 تم حفظ لقطة الشاشة بنجاح');
    } catch (_err) {
      this.onToast('تعذر التقاط الصورة بسبب قيود المصدر الخارجي', 'error');
    }
  }

  showBanner(message) {
    this.bannerToast.textContent = message;
    this.bannerToast.classList.remove('hidden');
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => {
      this.bannerToast.classList.add('hidden');
    }, 2400);
  }

  _showSpinner(msg) {
    this.spinnerText.textContent = msg || 'جاري التحميل...';
    this.spinner.classList.remove('hidden');
  }

  _hideSpinner() {
    this.spinner.classList.add('hidden');
  }
}

window.ArnVideoPlayer = ArnVideoPlayer;
