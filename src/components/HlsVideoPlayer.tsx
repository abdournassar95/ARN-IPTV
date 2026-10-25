import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Server,
  Sliders,
  Maximize2,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  SkipForward,
  SkipBack,
  Eye,
  EyeOff,
  Radio,
  X,
  Search,
  ListPlus,
  Tv,
  PictureInPicture2,
  Headphones,
} from 'lucide-react';
import { AspectRatioMode, ChannelItem, HlsQualityLevel, StreamServerSource } from '../types/iptv';

interface HlsVideoPlayerProps {
  channel: ChannelItem | null;
  onChannelWatched?: (channel: ChannelItem) => void;
  onServersLoaded?: (channelId: string, servers: StreamServerSource[]) => void;
  categoryChannels?: ChannelItem[];
  categoryTitle?: string;
  onSelectChannel?: (channel: ChannelItem) => void;
  onOpenPlaylistModal?: () => void;
}

export const HlsVideoPlayer: React.FC<HlsVideoPlayerProps> = ({
  channel,
  onChannelWatched,
  onServersLoaded,
  categoryChannels = [],
  categoryTitle = 'قنوات التصنيف',
  onSelectChannel,
  onOpenPlaylistModal,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Web Audio API refs for 200% volume amplification
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const connectedVideoRef = useRef<HTMLVideoElement | null>(null);

  // Servers state (dynamically fetched from Drama Live getLiveById)
  const [dynamicServers, setDynamicServers] = useState<StreamServerSource[]>([]);
  const [isLoadingServers, setIsLoadingServers] = useState<boolean>(false);
  const [serverIndex, setServerIndex] = useState<number>(0);

  // Playback & volume state (persisted across sessions)
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('arn_iptv_volume_pref'));
      return Number.isFinite(saved) && saved >= 0 && saved <= 200 ? saved : 100;
    } catch {
      return 100;
    }
  }); // 0 to 200%
  const [showVolOverlay, setShowVolOverlay] = useState<boolean>(false);
  const volOverlayTimerRef = useRef<number | null>(null);

  const [qualities, setQualities] = useState<HlsQualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto
  const [audioTracks, setAudioTracks] = useState<Array<{ id: number; name: string; lang?: string }>>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(0);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>(() => {
    try {
      const saved = localStorage.getItem('arn_iptv_aspect_pref') as AspectRatioMode | null;
      return saved && ['default', '16:9', '4:3', 'fill', 'cover'].includes(saved) ? saved : 'default';
    } catch {
      return 'default';
    }
  });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Auto-hide controls in fullscreen mode
  const [showControls, setShowControls] = useState<boolean>(true);
  const controlsTimerRef = useRef<number | null>(null);

  // Fullscreen Left Edge Channel Drawer
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState<boolean>(false);
  const [drawerSearch, setDrawerSearch] = useState<string>('');
  const leftDrawerTimerRef = useRef<number | null>(null);

  // Periodic Fullscreen Moving Watermark Ticker (Every 3 minutes / 180,000 ms)
  const [showWatermarkTicker, setShowWatermarkTicker] = useState<boolean>(false);
  const watermarkIntervalRef = useRef<number | null>(null);
  const watermarkHideTimerRef = useRef<number | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('جار فك التشفير...');
  const [failoverNotice, setFailoverNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  // Determine active servers list
  const effectiveServers = dynamicServers.length > 0 ? dynamicServers : (channel?.sources || []);
  const activeSource = effectiveServers[serverIndex] || effectiveServers[0];

  // Filter channels for the fullscreen left drawer
  const filteredDrawerChannels = useMemo(() => {
    if (!categoryChannels || categoryChannels.length === 0) return [];
    if (!drawerSearch.trim()) return categoryChannels;
    const q = drawerSearch.trim().toLowerCase();
    return categoryChannels.filter((c) => c.name.toLowerCase().includes(q));
  }, [categoryChannels, drawerSearch]);

  // Fetch full server candidates from Drama Live API when channel has fgLiveId
  useEffect(() => {
    if (!channel) {
      setDynamicServers([]);
      return;
    }

    setDynamicServers(channel.sources || []);

    if (channel.fgLiveId) {
      let active = true;
      setIsLoadingServers(true);
      fetch(
        `/api/fg/channel-servers/${encodeURIComponent(channel.fgLiveId)}?code=${encodeURIComponent(
          channel.fgCode || '202122'
        )}`
      )
        .then((r) => r.json())
        .then((data) => {
          if (!active) return;
          if (data.success && Array.isArray(data.servers) && data.servers.length > 0) {
            setDynamicServers(data.servers);
            onServersLoaded?.(channel.id, data.servers);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (active) setIsLoadingServers(false);
        });

      return () => {
        active = false;
      };
    }
  }, [channel?.id, channel?.fgLiveId, channel?.fgCode]);

  // Ensure WebAudio GainNode is wired for >100% volume boost
  const ensureAudioBoostGraph = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    try {
      if (!audioCtxRef.current) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      if (connectedVideoRef.current !== videoEl) {
        const source = audioCtxRef.current.createMediaElementSource(videoEl);
        const gain = audioCtxRef.current.createGain();
        source.connect(gain);
        gain.connect(audioCtxRef.current.destination);
        gainNodeRef.current = gain;
        connectedVideoRef.current = videoEl;
      }
    } catch {
      // Fallback to native HTML5 volume
    }
  }, []);

  // Volume ref to decouple high-frequency volume updates from event listener rebinding
  const volumeRef = useRef<number>(100);

  // Teardown WebAudio AudioContext & timers on component unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      if (volOverlayTimerRef.current) {
        window.clearTimeout(volOverlayTimerRef.current);
      }
      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current);
      }
      if (leftDrawerTimerRef.current) {
        window.clearTimeout(leftDrawerTimerRef.current);
      }
      if (watermarkIntervalRef.current) {
        window.clearInterval(watermarkIntervalRef.current);
      }
      if (watermarkHideTimerRef.current) {
        window.clearTimeout(watermarkHideTimerRef.current);
      }
    };
  }, []);

  // Apply volume (0 - 200%) with OSD overlay
  const applyVolume = useCallback(
    (newVol: number, triggerOverlay = true) => {
      const clamped = Math.max(0, Math.min(200, Math.round(newVol)));
      volumeRef.current = clamped;
      setVolumeState(clamped);
      try {
        localStorage.setItem('arn_iptv_volume_pref', String(clamped));
      } catch {}

      const videoEl = videoRef.current;
      if (videoEl) {
        if (clamped === 0) {
          videoEl.muted = true;
          setIsMuted(true);
        } else {
          videoEl.muted = false;
          setIsMuted(false);
        }

        if (clamped <= 100) {
          videoEl.volume = clamped / 100;
          if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = 1.0;
          }
        } else {
          ensureAudioBoostGraph();
          videoEl.volume = 1.0;
          if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = clamped / 100; // Up to 2.0x boost
          }
        }
      }

      if (triggerOverlay) {
        setShowVolOverlay(true);
        if (volOverlayTimerRef.current) {
          window.clearTimeout(volOverlayTimerRef.current);
        }
        volOverlayTimerRef.current = window.setTimeout(() => {
          setShowVolOverlay(false);
        }, 1200);
      }
    },
    [ensureAudioBoostGraph]
  );

  // Auto-hide controls timer in fullscreen mode
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
    }
    if (isFullscreen) {
      controlsTimerRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  }, [isFullscreen]);

  useEffect(() => {
    if (isFullscreen) {
      resetControlsTimer();
    } else {
      setShowControls(true);
      setIsLeftDrawerOpen(false);
      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current);
      }
    }
  }, [isFullscreen, resetControlsTimer]);

  // Handle mouse move across player: resets auto-hide & checks for left-edge trigger in fullscreen
  const handlePlayerMouseMove = (e: React.MouseEvent) => {
    resetControlsTimer();
    if (isFullscreen) {
      // Left edge detection (cursor near left border <= 45px)
      if (e.clientX <= 45) {
        if (leftDrawerTimerRef.current) {
          window.clearTimeout(leftDrawerTimerRef.current);
          leftDrawerTimerRef.current = null;
        }
        setIsLeftDrawerOpen(true);
      } else if (e.clientX > 380 && isLeftDrawerOpen) {
        // Leaving drawer area
        if (!leftDrawerTimerRef.current) {
          leftDrawerTimerRef.current = window.setTimeout(() => {
            setIsLeftDrawerOpen(false);
            leftDrawerTimerRef.current = null;
          }, 350);
        }
      }
    }
  };

  // Reset server index when channel changes
  useEffect(() => {
    setServerIndex(0);
    setFailoverNotice(null);
    setErrorMsg(null);
    if (channel && onChannelWatched) {
      onChannelWatched(channel);
    }
  }, [channel?.id]);

  // Load and play stream via Hls.js with Auto-Failover & Multi-Quality extraction
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !channel) return;

    if (!activeSource) return;

    setIsLoading(true);
    setErrorMsg(null);
    setLoadingMessage(
      channel.section === 'radio'
        ? 'جاري الاتصال بالإذاعة...'
        : 'جار فك التشفير...'
    );
    setQualities([]);
    setCurrentQuality(-1);
    setAudioTracks([]);
    setCurrentAudioTrack(0);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const handleAutoFailover = (reason: string) => {
      if (serverIndex + 1 < effectiveServers.length) {
        const nextIdx = serverIndex + 1;
        const nextServer = effectiveServers[nextIdx];
        if (channel.section !== 'radio') {
          setFailoverNotice(`تعذر الاتصال بالسيرفر الحالي (${reason}) — تم التحويل تلقائياً إلى ${nextServer.name}`);
        }
        setServerIndex(nextIdx);
      } else {
        setIsLoading(false);
        setErrorMsg('تعذر تشغيل البث من جميع السيرفرات المتاحة لهذه القناة. جرب التحديث أو اختيار سيرفر آخر.');
      }
    };

    const isDirectAudio =
      channel.section === 'radio' &&
      !activeSource.url.toLowerCase().includes('.m3u8');

    if (isDirectAudio) {
      videoEl.src = activeSource.url;
      videoEl.load();

      const onCanPlay = () => {
        setIsLoading(false);
        videoEl
          .play()
          .then(() => {
            setIsPlaying(true);
            applyVolume(volume, false);
          })
          .catch(() => {
            setIsPlaying(false);
          });
      };

      const onError = () => {
        handleAutoFailover('تعذر تشغيل تدفق الراديو الصوتي');
      };

      videoEl.addEventListener('canplay', onCanPlay, { once: true });
      videoEl.addEventListener('error', onError, { once: true });

      return () => {
        videoEl.removeEventListener('canplay', onCanPlay);
        videoEl.removeEventListener('error', onError);
      };
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        manifestLoadingTimeOut: 12000,
        manifestLoadingMaxRetry: 1,
        levelLoadingTimeOut: 12000,
      });
      hlsRef.current = hls;

      hls.loadSource(activeSource.url);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setIsLoading(false);
        const extractedLevels: HlsQualityLevel[] = data.levels.map((lvl, index) => {
          const height = lvl.height || 0;
          const bitrateKbps = Math.round((lvl.bitrate || 0) / 1000);
          let label = height ? `${height}p (${bitrateKbps} kbps)` : `مستوى ${index + 1} (${bitrateKbps} kbps)`;
          if (height >= 2160) label = `4K UHD (${height}p · ${bitrateKbps} kbps)`;
          else if (height >= 1080) label = `FHD 1080p (${bitrateKbps} kbps)`;
          else if (height >= 720) label = `HD 720p (${bitrateKbps} kbps)`;
          else if (height >= 480) label = `SD 480p (${bitrateKbps} kbps)`;
          else if (height > 0) label = `LD ${height}p (${bitrateKbps} kbps)`;

          return {
            index,
            height,
            width: lvl.width || 0,
            bitrate: bitrateKbps,
            label,
          };
        });

        setQualities(extractedLevels);
        if (Array.isArray(data.audioTracks) && data.audioTracks.length > 1) {
          setAudioTracks(
            data.audioTracks.map((t, idx) => ({
              id: idx,
              name: t.name || t.lang || `مسار صوتي ${idx + 1}`,
              lang: t.lang,
            }))
          );
        }
        videoEl
          .play()
          .then(() => {
            setIsPlaying(true);
            applyVolume(volume, false);
          })
          .catch(() => {
            setIsPlaying(false);
          });
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
        if (Array.isArray(data.audioTracks) && data.audioTracks.length > 1) {
          setAudioTracks(
            data.audioTracks.map((t, idx) => ({
              id: idx,
              name: t.name || t.lang || `مسار صوتي ${idx + 1}`,
              lang: t.lang,
            }))
          );
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.destroy();
              handleAutoFailover('خطأ في شبكة البث');
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              handleAutoFailover('خطأ غير متوقع في محرك HLS');
              break;
          }
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari / iOS HLS fallback
      videoEl.src = activeSource.url;
      videoEl
        .play()
        .then(() => {
          setIsLoading(false);
          setIsPlaying(true);
        })
        .catch(() => {
          setIsLoading(false);
          setIsPlaying(false);
        });
    } else {
      setIsLoading(false);
      setErrorMsg('متصفحك الحالي لا يدعم تقنية تشغيل دفق HLS.');
    }

    // Audio-only watchdog: If a TV channel plays audio but has 0 video dimensions, failover to next video server
    let audioOnlyCheckTimer: number | null = null;
    const onTimeUpdateAudioOnlyCheck = () => {
      if (channel.section !== 'radio' && videoEl.currentTime >= 2) {
        if (videoEl.videoWidth === 0 && videoEl.videoHeight === 0) {
          videoEl.removeEventListener('timeupdate', onTimeUpdateAudioOnlyCheck);
          if (audioOnlyCheckTimer) window.clearTimeout(audioOnlyCheckTimer);
          console.warn('[HlsVideoPlayer] Audio-only stream detected on TV channel, auto-failing over:', channel.name);
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
          handleAutoFailover('تم اكتشاف بث صوتي فقط بدون صورة — جاري التحويل التلقائي لسيرفر الفيديو المباشر');
        } else if (videoEl.videoWidth > 0) {
          videoEl.removeEventListener('timeupdate', onTimeUpdateAudioOnlyCheck);
          if (audioOnlyCheckTimer) window.clearTimeout(audioOnlyCheckTimer);
        }
      }
    };

    if (channel.section !== 'radio') {
      videoEl.addEventListener('timeupdate', onTimeUpdateAudioOnlyCheck);
      audioOnlyCheckTimer = window.setTimeout(() => {
        if (
          channel.section !== 'radio' &&
          videoEl &&
          !videoEl.paused &&
          videoEl.currentTime > 0.5 &&
          videoEl.videoWidth === 0 &&
          videoEl.videoHeight === 0
        ) {
          videoEl.removeEventListener('timeupdate', onTimeUpdateAudioOnlyCheck);
          console.warn('[HlsVideoPlayer] Watchdog: Audio-only stream detected on TV channel, auto-failing over:', channel.name);
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
          handleAutoFailover('تم اكتشاف بث صوتي فقط بدون صورة — جاري التحويل التلقائي لسيرفر الفيديو المباشر');
        }
      }, 3200);
    }

    return () => {
      videoEl.removeEventListener('timeupdate', onTimeUpdateAudioOnlyCheck);
      if (audioOnlyCheckTimer) {
        window.clearTimeout(audioOnlyCheckTimer);
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel?.id, activeSource?.url, serverIndex, effectiveServers.length]);

  // Toggle Play / Pause
  const togglePlayPause = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (videoEl.paused) {
      ensureAudioBoostGraph();
      videoEl
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      videoEl.pause();
      setIsPlaying(false);
    }
  }, [ensureAudioBoostGraph]);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const nextMuted = !videoEl.muted;
    videoEl.muted = nextMuted;
    setIsMuted(nextMuted);
  }, []);

  // Seek relative seconds
  const seekRelative = useCallback((deltaSeconds: number) => {
    const videoEl = videoRef.current;
    if (!videoEl || !Number.isFinite(videoEl.duration)) return;
    videoEl.currentTime = Math.max(0, Math.min(videoEl.duration, videoEl.currentTime + deltaSeconds));
  }, []);

  // Toggle Fullscreen
  const toggleFullscreen = useCallback(() => {
    const wrapperEl = wrapperRef.current;
    if (!wrapperEl) return;
    if (!document.fullscreenElement) {
      wrapperEl.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Toggle Picture-in-Picture (PiP)
  const togglePiP = useCallback(async () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoEl.requestPictureInPicture();
      }
    } catch {
      // Browser may not support PiP on audio-only or restricted streams
    }
  }, []);

  // Listen to fullscreenchange
  useEffect(() => {
    const onFsChange = () => {
      const isFs = Boolean(document.fullscreenElement);
      setIsFullscreen(isFs);
      if (isFs) {
        resetControlsTimer();
      } else {
        setShowControls(true);
        setIsLeftDrawerOpen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [resetControlsTimer]);

  // Fullscreen Periodic Watermark Ticker (Appears once every 3 minutes / 180,000 ms for ~26 seconds)
  useEffect(() => {
    if (!isFullscreen) {
      setShowWatermarkTicker(false);
      if (watermarkIntervalRef.current) {
        window.clearInterval(watermarkIntervalRef.current);
        watermarkIntervalRef.current = null;
      }
      if (watermarkHideTimerRef.current) {
        window.clearTimeout(watermarkHideTimerRef.current);
        watermarkHideTimerRef.current = null;
      }
      return;
    }

    const triggerTicker = () => {
      setShowWatermarkTicker(true);
      if (watermarkHideTimerRef.current) window.clearTimeout(watermarkHideTimerRef.current);
      watermarkHideTimerRef.current = window.setTimeout(() => {
        setShowWatermarkTicker(false);
      }, 42000); // 42 seconds for the smooth, slower marquee animation to complete its pass
    };

    // Show once 5 seconds after entering fullscreen so the user immediately sees it
    const initialDelay = window.setTimeout(() => {
      triggerTicker();
    }, 5000);

    // Schedule recurring display every 3 minutes (180,000 ms)
    watermarkIntervalRef.current = window.setInterval(() => {
      triggerTicker();
    }, 3 * 60 * 1000);

    return () => {
      window.clearTimeout(initialDelay);
      if (watermarkIntervalRef.current) {
        window.clearInterval(watermarkIntervalRef.current);
        watermarkIntervalRef.current = null;
      }
      if (watermarkHideTimerRef.current) {
        window.clearTimeout(watermarkHideTimerRef.current);
        watermarkHideTimerRef.current = null;
      }
    };
  }, [isFullscreen]);

  // Mouse wheel gesture over video container for 0-200% volume control
  useEffect(() => {
    const wrapperEl = wrapperRef.current;
    if (!wrapperEl) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      resetControlsTimer();
      ensureAudioBoostGraph();
      const step = 5;
      const currentVol = volumeRef.current;
      if (e.deltaY < 0) {
        applyVolume(currentVol + step, true);
      } else {
        applyVolume(currentVol - step, true);
      }
    };

    wrapperEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => wrapperEl.removeEventListener('wheel', handleWheel);
  }, [applyVolume, ensureAudioBoostGraph, resetControlsTimer]);

  // Global keyboard shortcuts (when not typing in an input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }

      resetControlsTimer();

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'f' || e.key === 'F' || e.key === 'ب') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M' || e.key === 'ة') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'h' || e.key === 'H' || e.key === 'ا') {
        e.preventDefault();
        setShowControls((prev) => !prev);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        ensureAudioBoostGraph();
        applyVolume(volumeRef.current + 5, true);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        ensureAudioBoostGraph();
        applyVolume(volumeRef.current - 5, true);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekRelative(10);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekRelative(-10);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    togglePlayPause,
    toggleFullscreen,
    toggleMute,
    applyVolume,
    seekRelative,
    ensureAudioBoostGraph,
    resetControlsTimer,
  ]);

  // Handle Quality Change
  const handleQualityChange = (levelIdx: number) => {
    setCurrentQuality(levelIdx);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIdx;
    }
  };

  // Handle Audio Track Change
  const handleAudioTrackChange = (trackIdx: number) => {
    setCurrentAudioTrack(trackIdx);
    if (hlsRef.current) {
      hlsRef.current.audioTrack = trackIdx;
    }
  };

  // Handle Aspect Ratio Change with Persistence
  const handleAspectRatioChange = (mode: AspectRatioMode) => {
    setAspectRatio(mode);
    try {
      localStorage.setItem('arn_iptv_aspect_pref', mode);
    } catch {}
  };

  // Compute video aspect ratio CSS (Support Cover & Fill for 100% monitor filling with no borders)
  const getVideoAspectStyle = (): React.CSSProperties => {
    switch (aspectRatio) {
      case 'cover':
        return { width: '100%', height: '100%', objectFit: 'cover' };
      case 'fill':
        return { width: '100%', height: '100%', objectFit: 'fill' };
      case '16:9':
        return { aspectRatio: '16 / 9', width: '100%', height: '100%', objectFit: 'contain' };
      case '4:3':
        return { aspectRatio: '4 / 3', width: '100%', height: '100%', objectFit: 'contain' };
      default:
        return { width: '100%', height: '100%', objectFit: 'contain' };
    }
  };

  const formatSeconds = (sec: number) => {
    if (!Number.isFinite(sec) || sec <= 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Render Apple TV / B&O Segmented Glass Server Track: [1 SD | 2 HD | 3 4K | 4 DLW ...]
  const renderDramaServerStrip = (isOverlay = false) => {
    if (!effectiveServers || effectiveServers.length === 0) return null;

    return (
      <div
        className={`flex items-center gap-2.5 overflow-x-auto no-scrollbar select-none py-1.5 px-3.5 ${
          isOverlay
            ? 'bg-[#070b14]/85 backdrop-blur-xl rounded-xl border border-white/[0.08] mt-2 max-w-full shadow-xl'
            : 'bg-[#070b14]/90 border-b border-white/[0.06] shrink-0'
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setFailoverNotice(null);
            if (hlsRef.current && activeSource) {
              setIsLoading(true);
              hlsRef.current.loadSource(activeSource.url);
            }
          }}
          className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
          title="تحديث وإعادة تحميل السيرفر الحالي"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>

        <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap shrink-0">
          الخوادم
        </span>

        {/* Unified Segmented Control Track */}
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-black/45 border border-white/[0.06] overflow-x-auto no-scrollbar">
          {effectiveServers.map((src, idx) => {
            const isActive = serverIndex === idx;
            const serverNum = src.serverNumber || idx + 1;
            const badge = src.badge;

            return (
              <button
                key={src.id || idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFailoverNotice(null);
                  setServerIndex(idx);
                }}
                title={src.name}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all duration-150 shrink-0 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white/[0.12] text-white border border-white/[0.14] shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <span className="text-xs font-semibold font-mono tabular-nums leading-none">
                  {serverNum}
                </span>
                {badge && (
                  <span
                    className={`text-[10px] font-mono tabular-nums uppercase tracking-wide leading-none ${
                      isActive ? 'text-emerald-400 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {isLoadingServers && (
          <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0 mr-1">
            جاري فحص الخوادم...
          </span>
        )}
      </div>
    );
  };

  // If app is completely clean and no channel is chosen yet
  if (!channel) {
    return (
      <section
        ref={wrapperRef}
        className="flex flex-col flex-1 h-full bg-[#090e1a]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden select-none items-center justify-center p-6 text-center"
      >
        <div className="max-w-md w-full bg-[#0f172a]/70 border border-white/[0.08] rounded-2xl p-8 shadow-2xl space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl p-2 bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
            <img
              src="/assets/icons/app_icon.png"
              alt="ARN"
              className="w-full h-full object-contain rounded-xl"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-white">مرحباً بك في ARN IPTV Pro</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              قم بإدخال كود التفعيل (FG Code) أو إضافة رابط قائمة M3U / Xtream لبدء المشاهدة.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenPlaylistModal}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
          >
            <ListPlus className="w-4 h-4" />
            <span>إضافة كود أو قائمة تشغيل</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={wrapperRef}
      onMouseMove={handlePlayerMouseMove}
      onTouchStart={resetControlsTimer}
      className={`relative flex flex-col flex-1 h-full select-none transition-colors duration-200 ${
        isFullscreen
          ? 'fixed inset-0 z-99999 w-screen h-screen bg-black border-0 rounded-none p-0 m-0 overflow-hidden'
          : 'bg-[#090e1a]/90 border border-white/8 rounded-xl overflow-hidden'
      } ${isFullscreen && !showControls && !isLeftDrawerOpen ? 'cursor-none' : 'cursor-default'}`}
    >
      {/* Invisible Hover Zone on the Left Edge to slide in Channels in Fullscreen */}
      {isFullscreen && (
        <div
          className="absolute top-0 bottom-0 left-0 w-8 z-40 pointer-events-auto"
          onMouseEnter={() => {
            if (leftDrawerTimerRef.current) window.clearTimeout(leftDrawerTimerRef.current);
            setIsLeftDrawerOpen(true);
          }}
        />
      )}

      {/* =========================================================================
          FULLSCREEN LEFT EDGE CHANNEL DRAWER
          ========================================================================= */}
      {isFullscreen && (
        <div
          onMouseEnter={() => {
            if (leftDrawerTimerRef.current) window.clearTimeout(leftDrawerTimerRef.current);
          }}
          onMouseLeave={() => {
            leftDrawerTimerRef.current = window.setTimeout(() => {
              setIsLeftDrawerOpen(false);
              leftDrawerTimerRef.current = null;
            }, 350);
          }}
          className={`fixed top-0 bottom-0 left-0 w-80 sm:w-88 bg-[#070b14]/95 backdrop-blur-2xl border-r border-white/12 z-50 shadow-2xl flex flex-col transition-transform duration-300 select-none ${
            isLeftDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#0a101f]/95 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
                <h3 className="text-sm font-bold text-white truncate">
                  {categoryTitle || 'قنوات التصنيف'}
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {filteredDrawerChannels.length} قناة متاحة
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsLeftDrawerOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="إغلاق قائمة القنوات"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Search */}
          <div className="p-3 border-b border-white/8 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={drawerSearch}
                onChange={(e) => setDrawerSearch(e.target.value)}
                placeholder="بحث في قنوات هذا التصنيف..."
                className="w-full bg-[#0f172a] border border-white/10 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Channels List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredDrawerChannels.length === 0 ? (
              <p className="text-xs text-slate-400 text-center p-4">لا توجد قنوات مطابقة للبحث</p>
            ) : (
              filteredDrawerChannels.map((ch, idx) => {
                const isCurrent = channel?.id === ch.id;
                return (
                  <button
                    key={ch.id || idx}
                    type="button"
                    onClick={() => {
                      onSelectChannel?.(ch);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-right transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-emerald-500/25 border border-emerald-500/50 text-white shadow-lg'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-xs text-slate-400 w-5 text-center shrink-0">
                        {idx + 1}
                      </span>
                      {/* Channel Logo in Drawer */}
                      <div className="w-8 h-8 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center p-1 overflow-hidden shrink-0">
                        {ch.logo ? (
                          <img
                            src={ch.logo}
                            alt=""
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Tv className="w-3.5 h-3.5 text-emerald-400/70" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{ch.name}</p>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {ch.resolution || 'Adaptive'}
                        </span>
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          NORMAL MODE: Top Header Bar
          ========================================================================= */}
      {!isFullscreen && (
        <div className="player-header flex items-center justify-between gap-4 px-4 py-2.5 bg-[#0f172a]/90 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isPlaying ? 'bg-emerald-400 shadow-[0_0_10px_#10b981]' : 'bg-amber-400'
              }`}
              title={isPlaying ? 'البث نشط ومستقر' : 'البث متوقف مؤقتاً'}
            />
            {channel?.logo && (
              <div className="w-9 h-9 rounded-lg bg-black/50 border border-white/15 flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-md">
                <img
                  src={channel.logo}
                  alt={channel.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-100 truncate">
                {channel ? channel.name : '— لم يتم تحديد قناة —'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 truncate">
                <span>{channel?.groupTitle || 'بث مباشر'}</span>
                {channel?.resolution && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-sky-400 tabular-nums">{channel.resolution}</span>
                  </>
                )}
                {activeSource?.hasK9xSwap && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-mono">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      k9x_ Decrypted
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400 font-mono tabular-nums">
                  {effectiveServers.length} خوادم
                </span>
              </div>
            </div>
          </div>

          {/* Top Header Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {effectiveServers.length > 0 && (
              <div className="hidden sm:flex items-center gap-2 bg-[#070b14]/90 border border-white/10 rounded-lg px-2.5 py-1.5">
                <Server className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <label htmlFor="serverSelect" className="text-xs text-slate-400 whitespace-nowrap">
                  السيرفر:
                </label>
                <select
                  id="serverSelect"
                  value={serverIndex}
                  onChange={(e) => {
                    setFailoverNotice(null);
                    setServerIndex(Number(e.target.value));
                  }}
                  className="bg-transparent text-xs font-semibold text-slate-100 focus:outline-none cursor-pointer max-w-47.5 truncate"
                >
                  {effectiveServers.map((src, idx) => (
                    <option key={src.id || idx} value={idx} className="bg-[#0f172a] text-slate-100">
                      {src.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setFailoverNotice(null);
                if (hlsRef.current && activeSource) {
                  setIsLoading(true);
                  setLoadingMessage(
                    channel?.section === 'radio'
                      ? 'جاري الاتصال بالإذاعة...'
                      : 'جار فك التشفير...'
                  );
                  hlsRef.current.loadSource(activeSource.url);
                }
              }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="إعادة تحميل البث"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={togglePiP}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="وضع صورة داخل صورة العائم (Picture-in-Picture)"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>

            <button
              id="btnFullscreen"
              type="button"
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
              title="ملء الشاشة الفعلي (F أو نقر مزدوج على الفيديو)"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          NORMAL MODE: Drama Live Horizontal Servers Strip
          ========================================================================= */}
      {!isFullscreen && renderDramaServerStrip(false)}

      {/* Auto-Failover Notification Banner */}
      {failoverNotice && !isFullscreen && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-xs text-amber-200 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{failoverNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setFailoverNotice(null)}
            className="text-amber-300 hover:text-white font-semibold whitespace-nowrap cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* =========================================================================
          MAIN VIDEO VIEWPORT (Supports Double-Click Fullscreen & Mouse Wheel Volume)
          ========================================================================= */}
      <div
        id="videoWrapper"
        onDoubleClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('.osd-bar') || target.closest('.player-header') || target.closest('button')) return;
          toggleFullscreen();
        }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button') || target.closest('select') || target.closest('input')) return;
          togglePlayPause();
        }}
        className={`relative bg-black flex items-center justify-center overflow-hidden cursor-pointer ${
          isFullscreen ? 'absolute inset-0 w-full h-full' : 'flex-1'
        }`}
      >
        <video
          ref={videoRef}
          id="videoPlayer"
          playsInline
          crossOrigin="anonymous"
          style={getVideoAspectStyle()}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          className="transition-all duration-150"
        />

        {/* Bang & Olufsen Acoustic Radio Studio when channel.section === 'radio' */}
        {channel?.section === 'radio' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-[#070b14] z-10 select-none overflow-hidden">
            {/* Subtle ambient studio illumination */}
            <div className="absolute w-96 h-96 rounded-full bg-white/[0.02] blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center text-center max-w-lg w-full space-y-6">
              {/* Anodized Acoustic Dial Container */}
              <div className="relative">
                <div
                  className={`w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-[#0f172a] border flex items-center justify-center p-5 shadow-2xl transition-all duration-300 ${
                    isPlaying
                      ? 'border-white/20 ring-8 ring-white/[0.03]'
                      : 'border-white/10'
                  }`}
                >
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt={channel.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        const fallback = parent?.querySelector('.radio-studio-fallback') as HTMLElement | null;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className={`radio-studio-fallback items-center justify-center w-full h-full text-slate-300 ${
                      channel.logo ? 'hidden' : 'flex'
                    }`}
                  >
                    <Radio className="w-12 h-12" />
                  </div>
                </div>
              </div>

              {/* Station Info & Unboxed Metadata */}
              <div className="space-y-1.5">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {channel.name}
                </h2>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                  <span>{channel.groupTitle}</span>
                  <span aria-hidden="true">·</span>
                  <span className={isPlaying ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                    {isPlaying ? 'بث إذاعي مباشر' : 'متوقف مؤقتاً'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-slate-400">HQ Audio</span>
                </div>
              </div>

              {/* Precision Acoustic Spectrum Waveform Bars */}
              <div className="flex items-end justify-center gap-1.5 h-10 py-1 px-5 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                {[
                  35, 65, 85, 45, 95, 60, 80, 40, 100, 75, 50, 90, 70, 40, 85, 55, 75, 90, 60, 80, 45, 95, 65, 35
                ].map((defaultHeight, idx) => {
                  const animDelay = (idx * 0.08).toFixed(2);
                  const animDuration = (0.5 + (idx % 5) * 0.15).toFixed(2);

                  return (
                    <div
                      key={idx}
                      className={`w-1 rounded-full transition-all duration-150 ${
                        isPlaying ? 'bg-emerald-400/90' : 'bg-white/15'
                      }`}
                      style={{
                        height: isPlaying ? `${defaultHeight}%` : '20%',
                        animation: isPlaying
                          ? `pulseEqualizer ${animDuration}s ease-in-out ${animDelay}s infinite alternate`
                          : 'none',
                      }}
                    />
                  );
                })}
              </div>

              {/* Station Quick Play/Pause button */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlayPause();
                  }}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-xs transition-all cursor-pointer ${
                    isPlaying
                      ? 'bg-white text-slate-950 hover:bg-slate-200'
                      : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>إيقاف مؤقت</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>تشغيل الإذاعة</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Mouse Wheel Volume & 200% Boost OSD Overlay */}
        {showVolOverlay && (
          <div
            id="volumeOverlay"
            className="pointer-events-none absolute inset-0 flex items-center justify-center z-30"
          >
            <div className="flex flex-col items-center gap-2.5 px-6 py-4 rounded-2xl bg-[#070b14]/90 backdrop-blur-md border border-white/15 shadow-2xl min-w-47.5">
              <div className="flex items-center gap-2.5">
                {volume === 0 || isMuted ? (
                  <VolumeX className="w-6 h-6 text-rose-400" />
                ) : (
                  <Volume2 className={`w-6 h-6 ${volume > 100 ? 'text-sky-400' : 'text-emerald-400'}`} />
                )}
                <span className="text-xl font-bold font-mono tabular-nums text-white">
                  {isMuted ? '0%' : `${volume}%`}
                </span>
                {volume > 100 && !isMuted && (
                  <span className="text-xs font-mono font-semibold text-sky-400">BOOST 200%</span>
                )}
              </div>
              <div className="w-36 h-2 bg-white/15 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 ${
                    volume > 100 ? 'bg-linear-to-r from-emerald-400 to-sky-400' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${(volume / 200) * 100}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-400">
                {volume > 100 ? 'مضخم صوتي متطور (WebAudio Gain)' : 'مستوى الصوت القياسي'}
              </span>
            </div>
          </div>
        )}

        {/* Loading Spinner Overlay */}
        {isLoading && (
          <div
            id="loadingSpinner"
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#070b14]/75 backdrop-blur-xs z-20"
          >
            <div className="w-12 h-12 rounded-full border-3 border-emerald-500/25 border-t-emerald-400 animate-spin" />
            <p className="text-xs font-semibold text-slate-200">{loadingMessage}</p>
          </div>
        )}

        {/* Error Overlay with Immediate Server Switch */}
        {errorMsg && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-[#070b14]/95 z-20 text-center">
            <AlertTriangle className="w-10 h-10 text-rose-400" />
            <p className="text-sm font-semibold text-slate-200 max-w-md">{errorMsg}</p>
            {effectiveServers.length > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl">
                {effectiveServers.map((src, idx) => (
                  <button
                    key={src.id || idx}
                    type="button"
                    onClick={() => setServerIndex(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      serverIndex === idx
                        ? 'bg-emerald-500 text-slate-950 shadow-lg'
                        : 'bg-white/10 text-slate-200 hover:bg-white/20'
                    }`}
                  >
                    تجربة {src.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Subtle EPG & Gesture Hint Bar at Bottom of Video (in normal mode) */}
        {!isFullscreen && channel?.epgCurrent && !isLoading && !errorMsg && (
          <div className="pointer-events-none absolute bottom-0 inset-x-0 bg-linear-to-t from-black/85 via-black/40 to-transparent px-4 pt-8 pb-2.5 flex items-center justify-between text-xs text-slate-300">
            <div className="truncate">
              <span className="text-emerald-400 font-semibold ml-1.5">يعرض الآن:</span>
              <span>{channel.epgCurrent}</span>
            </div>
            <div className="hidden xl:flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
              <span>نقر مزدوج: ملء الشاشة</span>
              <span>·</span>
              <span>عجلة الماوس: الصوت حتى 200%</span>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          FULLSCREEN FLOATING OVERLAYS: Auto-hides on inactivity
          ========================================================================= */}
      {isFullscreen && (
        <>
          {/* Top Floating Header & Drama Live Server Strip */}
          <div
            className={`absolute top-0 inset-x-0 z-40 bg-linear-to-b from-black/95 via-black/75 to-transparent px-6 pt-5 pb-8 transition-all duration-300 ${
              showControls
                ? 'opacity-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 -translate-y-4 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    isPlaying ? 'bg-emerald-400 shadow-[0_0_12px_#10b981]' : 'bg-amber-400'
                  }`}
                />
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-white truncate drop-shadow-md">
                    {channel ? channel.name : '— بث مباشر —'}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span>{channel?.groupTitle || 'بث فضائي'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-emerald-400">{channel?.resolution || 'FHD / HD'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-sky-300">مرر الفأرة لليسار لعرض قائمة القنوات</span>
                  </div>
                </div>
              </div>

              {/* Quick Fullscreen Controls */}
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowControls(false)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/60 hover:bg-black/90 text-slate-200 hover:text-white border border-white/12 transition-colors cursor-pointer text-xs"
                  title="إخفاء الأدوات فوراً (أو اضغط H)"
                >
                  <EyeOff className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">إخفاء الأدوات (H)</span>
                </button>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/40 transition-colors cursor-pointer"
                  title="الخروج من ملء الشاشة (Esc أو F)"
                >
                  <Minimize className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drama Live Servers in Fullscreen */}
            {renderDramaServerStrip(true)}
          </div>

          {/* Bottom Floating OSD Controls Overlay */}
          <div
            className={`absolute bottom-0 inset-x-0 z-40 bg-linear-to-t from-black/95 via-black/75 to-transparent px-6 pb-5 pt-10 transition-all duration-300 ${
              showControls
                ? 'opacity-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Playback Controls & Volume */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center transition-colors shadow-lg cursor-pointer shrink-0"
                  title="تشغيل / إيقاف مؤقت (Space)"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => seekRelative(-10)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer"
                  title="إرجاع 10 ثوانٍ"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => seekRelative(10)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer"
                  title="تقديم 10 ثوانٍ"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer shrink-0"
                  title="كتم / تشغيل الصوت (M)"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className={`w-4 h-4 ${volume > 100 ? 'text-sky-400' : 'text-emerald-400'}`} />
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={200}
                    step={5}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      ensureAudioBoostGraph();
                      applyVolume(Number(e.target.value), true);
                    }}
                    className="arn-slider w-28 sm:w-36"
                    title="التحكم بالصوت حتى 200%"
                  />
                  <span
                    className={`text-xs font-mono font-semibold tabular-nums w-12 text-left ${
                      volume > 100 ? 'text-sky-400' : 'text-slate-200'
                    }`}
                  >
                    {isMuted ? '0%' : `${volume}%`}
                  </span>
                </div>
              </div>

              {/* Quality & Aspect Ratio in Fullscreen */}
              <div className="flex items-center gap-3">
                {/* Multi-Quality Selector */}
                <div className="flex items-center gap-1.5 bg-[#070b14]/90 border border-white/15 rounded-xl px-3 py-1.5">
                  <Sliders className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <select
                    value={currentQuality}
                    onChange={(e) => handleQualityChange(Number(e.target.value))}
                    className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value={-1} className="bg-[#0f172a] text-slate-100">
                      الجودة: تلقائي
                    </option>
                    {qualities.map((q) => (
                      <option key={q.index} value={q.index} className="bg-[#0f172a] text-slate-100">
                        {q.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Aspect Ratio Selector (Cover / Fill / 16:9 / 4:3) */}
                <div className="flex items-center gap-1.5 bg-[#070b14]/90 border border-white/15 rounded-xl px-3 py-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <select
                    value={aspectRatio}
                    onChange={(e) => handleAspectRatioChange(e.target.value as AspectRatioMode)}
                    className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer"
                    title="نسبة أبعاد الشاشة وملاءمتها"
                  >
                    <option value="default" className="bg-[#0f172a] text-slate-100">
                      أبعاد تلقائية (Contain)
                    </option>
                    <option value="cover" className="bg-[#0f172a] text-slate-100">
                      ملء كامل بدون حواف (Cover) ⭐
                    </option>
                    <option value="fill" className="bg-[#0f172a] text-slate-100">
                      تمديد كامل للشاشة (Fill)
                    </option>
                    <option value="16:9" className="bg-[#0f172a] text-slate-100">
                      16:9 (شاشة عريضة)
                    </option>
                    <option value="4:3" className="bg-[#0f172a] text-slate-100">
                      4:3 (كلاسيكي)
                    </option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer"
                  title="الخروج من ملء الشاشة (F أو Esc)"
                >
                  <Minimize className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* =========================================================================
          FULLSCREEN SEMI-TRANSPARENT MOVING WATERMARK TICKER
          (Appears once every 3 minutes for ~26 seconds as a moving news ticker)
          ========================================================================= */}
      {isFullscreen && (
        <aside
          aria-label="شريط العلامة المائية الإخباري"
          className={`fixed left-0 right-0 z-40 pointer-events-none transition-all duration-1000 ${
            showControls ? 'bottom-20 sm:bottom-24' : 'bottom-6'
          } ${
            showWatermarkTicker
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="w-full bg-black/45 backdrop-blur-md border-y border-white/15 shadow-[0_4px_30px_rgba(0,0,0,0.6)] overflow-hidden py-3 sm:py-3.5 select-none">
            <div className="arn-ticker-track text-sm sm:text-base font-bold text-white/95 tracking-wide">
              {/* Ticker Segment 1 */}
              <div className="inline-flex items-center gap-8 px-10">
                <div className="inline-flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_12px_#10b981] animate-pulse" />
                  <span className="font-black text-white tracking-wider text-base sm:text-lg">ARN Technology</span>
                  <span className="text-white/40">·</span>
                  <span className="text-white/90">شركة ARN Technology للحلول البرمجية</span>
                </div>
                <span className="text-white/35 text-sm">✦</span>
                <div className="inline-flex items-center gap-2">
                  <span className="text-emerald-400 font-extrabold">تطوير وبرمجة:</span>
                  <span className="text-white font-extrabold">عبده رجب نصار</span>
                </div>
                <span className="text-white/35 text-sm">✦</span>
                <div className="inline-flex items-center gap-2">
                  <span className="text-sky-400 font-extrabold">هاتف / واتساب:</span>
                  <span className="text-white font-mono font-black tracking-wider text-sm sm:text-base" dir="ltr">+20 155 671 0314</span>
                </div>
                <span className="text-white/35 text-sm">✦</span>
                <div className="text-white/75 text-xs sm:text-sm">
                  حقوق النشر © 2026 ARN Technology · جميع الحقوق محفوظة
                </div>
              </div>

              {/* Ticker Segment 2 (Repeated for seamless continuous scroll) */}
              <div className="inline-flex items-center gap-8 px-10">
                <div className="inline-flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_12px_#10b981] animate-pulse" />
                  <span className="font-black text-white tracking-wider text-base sm:text-lg">ARN Technology</span>
                  <span className="text-white/40">·</span>
                  <span className="text-white/90">شركة ARN Technology للحلول البرمجية</span>
                </div>
                <span className="text-white/35 text-sm">✦</span>
                <div className="inline-flex items-center gap-2">
                  <span className="text-emerald-400 font-extrabold">تطوير وبرمجة:</span>
                  <span className="text-white font-extrabold">عبده رجب نصار</span>
                </div>
                <span className="text-white/35 text-sm">✦</span>
                <div className="inline-flex items-center gap-2">
                  <span className="text-sky-400 font-extrabold">هاتف / واتساب:</span>
                  <span className="text-white font-mono font-black tracking-wider text-sm sm:text-base" dir="ltr">+20 155 671 0314</span>
                </div>
                <span className="text-white/35 text-sm">✦</span>
                <div className="text-white/75 text-xs sm:text-sm">
                  حقوق النشر © 2026 ARN Technology · جميع الحقوق محفوظة
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* =========================================================================
          NORMAL MODE: Bottom Professional OSD Control Bar
          ========================================================================= */}
      {!isFullscreen && (
        <div className="osd-bar flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#0f172a] border-t border-white/8 shrink-0">
          {/* Left/Right Playback & Volume Controls */}
          <div className="flex items-center gap-2.5">
            <button
              id="btnPlayPause"
              type="button"
              onClick={togglePlayPause}
              className="w-9 h-9 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              title="تشغيل / إيقاف مؤقت (Space)"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            <button
              type="button"
              onClick={() => seekRelative(-10)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="إرجاع 10 ثوانٍ (السهم الأيسر)"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => seekRelative(10)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="تقديم 10 ثوانٍ (السهم الأيمن)"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              id="btnMute"
              type="button"
              onClick={toggleMute}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 transition-colors shrink-0 cursor-pointer"
              title="كتم / تشغيل الصوت (M)"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className={`w-4 h-4 ${volume > 100 ? 'text-sky-400' : 'text-emerald-400'}`} />
              )}
            </button>

            <div className="flex items-center gap-2">
              <input
                id="volSlider"
                type="range"
                min={0}
                max={200}
                step={5}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  ensureAudioBoostGraph();
                  applyVolume(Number(e.target.value), true);
                }}
                className="arn-slider w-24 sm:w-28"
                title="التحكم بالصوت وتضخيمه حتى 200% (عجلة الماوس)"
              />
              <span
                id="volLabel"
                className={`text-xs font-mono font-semibold tabular-nums w-11 text-left ${
                  volume > 100 ? 'text-sky-400' : 'text-slate-200'
                }`}
              >
                {isMuted ? '0%' : `${volume}%`}
              </span>
            </div>

            {duration > 0 && Number.isFinite(duration) && (
              <span className="hidden md:inline-block text-xs font-mono text-slate-400 tabular-nums mr-1">
                {formatSeconds(currentTime)} / {formatSeconds(duration)}
              </span>
            )}
          </div>

          {/* Adaptive Quality Selector, Multi-Audio Track & Aspect Ratio Switcher */}
          <div className="flex items-center gap-2">
            {/* Multi-Audio Track Selector (when stream has multiple commentators/languages) */}
            {audioTracks.length > 1 && (
              <div className="flex items-center gap-1.5 bg-[#070b14] border border-white/10 rounded-lg px-2.5 py-1.5">
                <Headphones className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <select
                  value={currentAudioTrack}
                  onChange={(e) => handleAudioTrackChange(Number(e.target.value))}
                  className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer whitespace-nowrap"
                  title="اختيار المسار الصوتي / المعلق"
                >
                  {audioTracks.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#0f172a] text-slate-100">
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Multi-Quality Selector */}
            <div className="flex items-center gap-1.5 bg-[#070b14] border border-white/10 rounded-lg px-2.5 py-1.5">
              <Sliders className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <select
                id="qualitySelect"
                value={currentQuality}
                onChange={(e) => handleQualityChange(Number(e.target.value))}
                className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer whitespace-nowrap"
                title="اختيار دقة البث (Adaptive HLS Levels)"
              >
                <option value={-1} className="bg-[#0f172a] text-slate-100">
                  الجودة: تلقائي (Auto)
                </option>
                {qualities.map((q) => (
                  <option key={q.index} value={q.index} className="bg-[#0f172a] text-slate-100">
                    {q.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Aspect Ratio Selector */}
            <div className="flex items-center gap-1.5 bg-[#070b14] border border-white/10 rounded-lg px-2.5 py-1.5">
              <Maximize2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <select
                id="aspectRatioSelect"
                value={aspectRatio}
                onChange={(e) => handleAspectRatioChange(e.target.value as AspectRatioMode)}
                className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer whitespace-nowrap"
                title="نسبة أبعاد الشاشة وملاءمتها"
              >
                <option value="default" className="bg-[#0f172a] text-slate-100">
                  أبعاد تلقائية
                </option>
                <option value="cover" className="bg-[#0f172a] text-slate-100">
                  ملء كامل بدون حواف (Cover) ⭐
                </option>
                <option value="fill" className="bg-[#0f172a] text-slate-100">
                  ملاءمة كاملة (Fill)
                </option>
                <option value="16:9" className="bg-[#0f172a] text-slate-100">
                  16:9 (شاشة عريضة)
                </option>
                <option value="4:3" className="bg-[#0f172a] text-slate-100">
                  4:3 (كلاسيكي)
                </option>
              </select>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
