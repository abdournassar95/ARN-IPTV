import React, { useEffect, useMemo, useState } from 'react';
import {
  Tv,
  Film,
  Layers,
  Star,
  History,
  ListPlus,
  Info,
  Search,
  FolderOpen,
  Radio,
  ShieldCheck,
  Play,
  X,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import {
  CategoryItem,
  ChannelItem,
  ContentSection,
  PlaylistSource,
  StreamServerSource,
} from './types/iptv';
import { HlsVideoPlayer } from './components/HlsVideoPlayer';
import { PlaylistModal } from './components/PlaylistModal';
import { AboutModal } from './components/AboutModal';
import { SplashScreen } from './components/SplashScreen';
import { getCategoryVisual } from './utils/iptvIcons';
import { ARABIC_RADIO_CATEGORIES, ARABIC_RADIO_CHANNELS } from './server/arabicRadioCatalog';
import { getEgyptianChannels } from './server/egyptCatalog';

// Storage keys for a clean, user-driven IPTV experience (no default mock data)
const STORAGE_KEYS = {
  FAVORITES: 'arn_iptv_clean_v5_favorites',
  HISTORY: 'arn_iptv_clean_v5_history',
  CUSTOM_PLAYLISTS: 'arn_iptv_clean_v5_playlists',
  CUSTOM_CATEGORIES: 'arn_iptv_clean_v5_categories',
  CUSTOM_CHANNELS: 'arn_iptv_clean_v5_channels',
};

export default function App() {
  // Playlists, Categories, Channels state (Starts completely clean until user adds playlists or FG codes)
  const [playlists, setPlaylists] = useState<PlaylistSource[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_PLAYLISTS);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [categories, setCategories] = useState<CategoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_CATEGORIES);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [channels, setChannels] = useState<ChannelItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_CHANNELS);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [activePlaylistId, setActivePlaylistId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_PLAYLISTS);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed[0].id : '';
    } catch {
      return '';
    }
  });

  const [activeSection, setActiveSection] = useState<ContentSection>('live');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [loadingCategoryId, setLoadingCategoryId] = useState<string | null>(null);

  // Toggle state for collapsible Categories panel (folded by default as requested)
  const [isCategoriesOpen, setIsCategoriesOpen] = useState<boolean>(false);

  // Search and Filter States
  const [catSearch, setCatSearch] = useState<string>('');
  const [chSearch, setChSearch] = useState<string>('');
  const [onlyFavFilter, setOnlyFavFilter] = useState<boolean>(false);

  // Favorites & Watch History IDs
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [historyIds, setHistoryIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Currently Playing Channel (Prioritize MBC Masr on startup)
  const [activeChannel, setActiveChannel] = useState<ChannelItem | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_CHANNELS);
      const parsed: ChannelItem[] = saved ? JSON.parse(saved) : [];
      if (parsed.length > 0) {
        const mbcMasr = parsed.find(
          (c) =>
            c.fgLiveId === 'live_tv_mbcmsr' ||
            c.name.includes('MBC Masr 1') ||
            c.name.includes('إم بي سي مصر 1') ||
            c.name.includes('MBC Masr') ||
            c.name.includes('إم بي سي مصر')
        );
        return mbcMasr || parsed[0];
      }
      return null;
    } catch {
      return null;
    }
  });

  // Modals
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState<boolean>(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState<boolean>(false);
  const [isSplashOpen, setIsSplashOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('arn_iptv_show_splash_startup') !== 'false';
    } catch {
      return true;
    }
  });
  const [hasAutoOpenedEgypt, setHasAutoOpenedEgypt] = useState<boolean>(false);

  // Automatically show input modal on first run or when database is empty
  useEffect(() => {
    if (playlists.length === 0 && channels.length === 0) {
      setIsPlaylistModalOpen(true);
    }
  }, []);

  // Automatically sync and open all 61 Egypt channels with MBC Masr active on launch
  useEffect(() => {
    if (channels.length === 0 || categories.length === 0) return;

    const targetPlId = activePlaylistId || (playlists.length > 0 ? playlists[0].id : '');
    const activePl = playlists.find((p) => p.id === targetPlId);
    const code = activePl?.type === 'fg_code' ? activePl.codeOrUrl : '202122';

    const egyptCat = categories.find(
      (c) =>
        (!targetPlId || c.playlistId === targetPlId) &&
        (c.name.includes('مصر') || c.id.toLowerCase().includes('eg') || c.name.toLowerCase().includes('egypt'))
    );

    if (egyptCat) {
      const currentEgChannels = channels.filter(
        (ch) =>
          (!targetPlId || ch.playlistId === targetPlId) &&
          (ch.categoryId === egyptCat.id || ch.groupTitle.includes('مصر'))
      );

      const hasAhlyOrSport = currentEgChannels.some(
        (ch) =>
          ch.fgLiveId === 'live_tv_alahlytv' ||
          ch.name.includes('الاهلي') ||
          ch.name.includes('Ahly') ||
          ch.name.includes('أون سبورت') ||
          ch.name.includes('Sport')
      );

      // If user had older cached Egypt channels missing Al Ahly or ON Sport or count < 60, auto-upgrade immediately!
      if (!hasAhlyOrSport || currentEgChannels.length < 60) {
        const fullEgChannels = getEgyptianChannels(targetPlId, code, egyptCat.id);
        setChannels((prev) => {
          const others = prev.filter(
            (ch) =>
              !(
                (!targetPlId || ch.playlistId === targetPlId) &&
                (ch.categoryId === egyptCat.id || ch.groupTitle.includes('مصر'))
              )
          );
          const updated = [...fullEgChannels, ...others];
          try {
            localStorage.setItem(STORAGE_KEYS.CUSTOM_CHANNELS, JSON.stringify(updated.slice(0, 1500)));
          } catch {}
          return updated;
        });

        setCategories((prev) =>
          prev.map((c) =>
            c.id === egyptCat.id && (!targetPlId || c.playlistId === targetPlId)
              ? { ...c, count: fullEgChannels.length }
              : c
          )
        );

        // Find MBC Masr in Egypt channels as default playing channel
        const mbcMasr = fullEgChannels.find(
          (c) =>
            c.fgLiveId === 'live_tv_mbcmsr' ||
            c.name.includes('MBC Masr 1') ||
            c.name.includes('إم بي سي مصر 1') ||
            c.name.includes('MBC Masr') ||
            c.name.includes('إم بي سي مصر')
        );
        setActiveChannel(mbcMasr || fullEgChannels[0]);
      } else if (!hasAutoOpenedEgypt) {
        const mbcMasr = currentEgChannels.find(
          (c) =>
            c.fgLiveId === 'live_tv_mbcmsr' ||
            c.name.includes('MBC Masr 1') ||
            c.name.includes('إم بي سي مصر 1') ||
            c.name.includes('MBC Masr') ||
            c.name.includes('إم بي سي مصر')
        );
        setActiveChannel(mbcMasr || currentEgChannels[0]);
      }

      if (!hasAutoOpenedEgypt) {
        setSelectedCategoryId(egyptCat.id);
        setActiveSection('live');
        setHasAutoOpenedEgypt(true);
      }
    }
  }, [channels, categories, activePlaylistId, playlists, hasAutoOpenedEgypt]);

  // Persist Favorites & History
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favoriteIds));
    } catch {}
  }, [favoriteIds]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(historyIds));
    } catch {}
  }, [historyIds]);

  // Keep active playlist valid if lists change
  useEffect(() => {
    if (playlists.length > 0 && (!activePlaylistId || !playlists.some((p) => p.id === activePlaylistId))) {
      setActivePlaylistId(playlists[0].id);
    }
  }, [playlists, activePlaylistId]);

  // Set default category when switching section or playlist (Egypt first)
  useEffect(() => {
    if (activeSection === 'radio') {
      setSelectedCategoryId('rad-cat-eg');
      const firstEgRadio = ARABIC_RADIO_CHANNELS.find((ch) => ch.categoryId === 'rad-cat-eg') || ARABIC_RADIO_CHANNELS[0];
      if (firstEgRadio) {
        setActiveChannel(firstEgRadio);
      }
    } else if (activeSection === 'live') {
      const egyptCat = categories.find(
        (c) =>
          c.playlistId === activePlaylistId &&
          (c.name.includes('مصر') || c.id.toLowerCase().includes('eg') || c.name.toLowerCase().includes('egypt'))
      );
      if (egyptCat) {
        setSelectedCategoryId(egyptCat.id);
      } else {
        setSelectedCategoryId('ALL');
      }
    } else {
      setSelectedCategoryId('ALL');
    }
  }, [activeSection, activePlaylistId]);

  // Fetch channels on demand when clicking a category with remoteTopic that hasn't loaded channels yet
  useEffect(() => {
    if (selectedCategoryId === 'ALL' || !activePlaylistId) return;
    const cat = categories.find(
      (c) => c.id === selectedCategoryId && c.playlistId === activePlaylistId
    );
    if (!cat || !cat.remoteTopic) return;

    const isEgypt =
      cat.name.includes('مصر') ||
      cat.id.toLowerCase().includes('eg') ||
      cat.name.toLowerCase().includes('egypt');

    const hasAhlyOrSport = channels.some(
      (ch) =>
        ch.playlistId === activePlaylistId &&
        (ch.categoryId === selectedCategoryId || ch.groupTitle.includes('مصر')) &&
        (ch.fgLiveId === 'live_tv_alahlytv' ||
          ch.name.includes('الاهلي') ||
          ch.name.includes('Ahly') ||
          ch.name.includes('أون سبورت') ||
          ch.name.includes('Sport'))
    );

    const existingCount = channels.filter(
      (ch) =>
        ch.playlistId === activePlaylistId &&
        (ch.categoryId === selectedCategoryId || (isEgypt && ch.groupTitle.includes('مصر')))
    ).length;

    if (existingCount >= (cat.count || 50) && (!isEgypt || hasAhlyOrSport)) return;

    let cancelled = false;
    const activePl = playlists.find((p) => p.id === activePlaylistId);
    const code = activePl?.type === 'fg_code' ? activePl.codeOrUrl : '202122';
    const remoteTopicToFetch = isEgypt ? '20' : cat.remoteTopic;

    setLoadingCategoryId(selectedCategoryId);
    fetch(
      `/api/fg/topic/${encodeURIComponent(remoteTopicToFetch)}?code=${encodeURIComponent(
        code
      )}&playlistId=${encodeURIComponent(activePlaylistId)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.success || !Array.isArray(data.channels)) return;
        const normalized: ChannelItem[] = data.channels.map((ch: ChannelItem) => ({
          ...ch,
          playlistId: activePlaylistId,
          categoryId: cat.id,
        }));
        setChannels((prev) => {
          const filtered = prev.filter(
            (c) => !(c.playlistId === activePlaylistId && c.categoryId === cat.id)
          );
          const updated = [...filtered, ...normalized];
          try {
            localStorage.setItem(STORAGE_KEYS.CUSTOM_CHANNELS, JSON.stringify(updated.slice(0, 1000)));
          } catch {}
          return updated;
        });
        if (normalized.length > 0) {
          setCategories((prev) =>
            prev.map((c) =>
              c.id === cat.id && c.playlistId === activePlaylistId
                ? { ...c, count: normalized.length }
                : c
            )
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingCategoryId(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCategoryId, activePlaylistId, categories, channels, playlists]);

  const toggleFavorite = (channelId: string) => {
    setFavoriteIds((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [channelId, ...prev]
    );
  };

  const handleChannelWatched = (ch: ChannelItem) => {
    setHistoryIds((prev) => [ch.id, ...prev.filter((id) => id !== ch.id)].slice(0, 50));
  };

  const handleServersLoaded = (channelId: string, loadedServers: StreamServerSource[]) => {
    setChannels((prev) =>
      prev.map((ch) => (ch.id === channelId ? { ...ch, sources: loadedServers } : ch))
    );
    if (activeChannel && activeChannel.id === channelId) {
      setActiveChannel((prev) => (prev ? { ...prev, sources: loadedServers } : null));
    }
  };

  const handleImportSuccess = (
    newPlaylist: PlaylistSource,
    newCategories: CategoryItem[],
    newChannels: ChannelItem[]
  ) => {
    setPlaylists((prev) => {
      const updated = [newPlaylist, ...prev.filter((p) => p.id !== newPlaylist.id)];
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_PLAYLISTS, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setCategories((prev) => {
      const filtered = prev.filter((c) => c.playlistId !== newPlaylist.id);
      const updated = [...filtered, ...newCategories];
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_CATEGORIES, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setChannels((prev) => {
      const filtered = prev.filter((ch) => ch.playlistId !== newPlaylist.id);
      const updated = [...filtered, ...newChannels];
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_CHANNELS, JSON.stringify(updated.slice(0, 1000)));
      } catch {}
      return updated;
    });

    setActivePlaylistId(newPlaylist.id);
    const egyptCat = newCategories.find(
      (c) => c.name.includes('مصر') || c.id.toLowerCase().includes('eg') || c.name.toLowerCase().includes('egypt')
    );
    if (egyptCat) {
      setSelectedCategoryId(egyptCat.id);
      setActiveSection('live');
      const mbcMasr = newChannels.find(
        (ch) =>
          (ch.categoryId === egyptCat.id || ch.groupTitle.includes('مصر')) &&
          (ch.fgLiveId === 'live_tv_mbcmsr' ||
            ch.name.includes('MBC Masr 1') ||
            ch.name.includes('إم بي سي مصر 1') ||
            ch.name.includes('MBC Masr') ||
            ch.name.includes('إم بي سي مصر'))
      );
      if (mbcMasr) {
        setActiveChannel(mbcMasr);
      } else {
        const egyptChannel = newChannels.find((ch) => ch.categoryId === egyptCat.id);
        if (egyptChannel) {
          setActiveChannel(egyptChannel);
        } else if (newChannels.length > 0) {
          setActiveChannel(newChannels[0]);
        }
      }
    } else {
      setSelectedCategoryId('ALL');
      if (newChannels.length > 0) {
        setActiveChannel(newChannels[0]);
      }
    }
  };

  const handleDeletePlaylist = (playlistId: string) => {
    setPlaylists((prev) => {
      const updated = prev.filter((p) => p.id !== playlistId);
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_PLAYLISTS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setCategories((prev) => {
      const updated = prev.filter((c) => c.playlistId !== playlistId);
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_CATEGORIES, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setChannels((prev) => {
      const updated = prev.filter((ch) => ch.playlistId !== playlistId);
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_CHANNELS, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (activePlaylistId === playlistId) {
      setPlaylists((curr) => {
        const remaining = curr.filter((p) => p.id !== playlistId);
        const nextId = remaining.length > 0 ? remaining[0].id : '';
        setActivePlaylistId(nextId);
        const nextCh = channels.find((c) => c.playlistId === nextId);
        setActiveChannel(nextCh || null);
        return remaining;
      });
    }
  };

  // Filtered Categories for Categories Panel
  const visibleCategories = useMemo(() => {
    if (activeSection === 'radio') {
      const plId = activePlaylistId || 'arn-arabic-radio-2026';
      return ARABIC_RADIO_CATEGORIES.map((cat) => {
        const matching = ARABIC_RADIO_CHANNELS.filter((ch) => ch.categoryId === cat.id);
        const count = matching.length > 0 ? matching.length : cat.count;
        return {
          ...cat,
          playlistId: plId,
          count,
        };
      }).filter((cat) => {
        if (catSearch.trim() && !cat.name.toLowerCase().includes(catSearch.trim().toLowerCase())) {
          return false;
        }
        return true;
      });
    }

    if (!activePlaylistId) return [];
    const baseSection = activeSection === 'fav' || activeSection === 'history' ? null : activeSection;
    return categories.filter((cat) => {
      if (cat.playlistId !== activePlaylistId) return false;
      if (baseSection && cat.section !== baseSection) return false;
      if (catSearch.trim() && !cat.name.toLowerCase().includes(catSearch.trim().toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [categories, activePlaylistId, activeSection, catSearch, channels]);

  // Filtered Channels for Channels Panel
  const visibleChannels = useMemo(() => {
    if (activeSection === 'radio') {
      const plId = activePlaylistId || 'arn-arabic-radio-2026';
      let list = ARABIC_RADIO_CHANNELS.map((ch) => ({ ...ch, playlistId: plId }));
      if (selectedCategoryId !== 'ALL') {
        list = list.filter((ch) => ch.categoryId === selectedCategoryId);
      }
      if (onlyFavFilter) {
        list = list.filter((ch) => favoriteIds.includes(ch.id));
      }
      if (chSearch.trim()) {
        const q = chSearch.trim().toLowerCase();
        list = list.filter(
          (ch) => ch.name.toLowerCase().includes(q) || ch.groupTitle.toLowerCase().includes(q)
        );
      }
      return list;
    }

    if (playlists.length === 0) return [];
    let list = channels.filter((ch) => ch.playlistId === activePlaylistId);

    if (activeSection === 'fav') {
      list = channels.filter((ch) => favoriteIds.includes(ch.id));
    } else if (activeSection === 'history') {
      list = historyIds
        .map((id) => channels.find((c) => c.id === id))
        .filter((c): c is ChannelItem => Boolean(c));
    } else {
      list = list.filter((ch) => ch.section === activeSection);
    }

    if (selectedCategoryId !== 'ALL') {
      const selectedCat = categories.find(
        (c) => c.id === selectedCategoryId && c.playlistId === activePlaylistId
      );
      const isEgyptCategory =
        selectedCat &&
        (selectedCat.name.includes('مصر') ||
          selectedCat.id.toLowerCase().includes('eg') ||
          selectedCat.id.toLowerCase().includes('20') ||
          selectedCat.name.toLowerCase().includes('egypt'));

      list = list.filter((ch) => {
        if (ch.categoryId === selectedCategoryId) return true;
        if (
          isEgyptCategory &&
          (ch.groupTitle.includes('مصر') ||
            ch.categoryId.toLowerCase().includes('eg') ||
            ch.categoryId.toLowerCase().includes('20'))
        ) {
          return true;
        }
        return false;
      });
    }

    if (onlyFavFilter) {
      list = list.filter((ch) => favoriteIds.includes(ch.id));
    }

    if (chSearch.trim()) {
      const q = chSearch.trim().toLowerCase();
      list = list.filter(
        (ch) => ch.name.toLowerCase().includes(q) || ch.groupTitle.toLowerCase().includes(q)
      );
    }

    return list;
  }, [channels, activePlaylistId, activeSection, selectedCategoryId, onlyFavFilter, chSearch, favoriteIds, historyIds, playlists.length]);

  // Automatically ensure radio stations are loaded when user switches to radio section
  useEffect(() => {
    if (activeSection !== 'radio') return;
    const plId = activePlaylistId || 'arn-arabic-radio-2026';
    const radioCats = ARABIC_RADIO_CATEGORIES.map((c) => ({ ...c, playlistId: plId }));
    const radioChs = ARABIC_RADIO_CHANNELS.map((ch) => ({ ...ch, playlistId: plId }));

    setCategories((prev) => {
      const nonRadio = prev.filter((c) => c.section !== 'radio');
      const updated = [...nonRadio, ...radioCats];
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_CATEGORIES, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setChannels((prev) => {
      const nonRadio = prev.filter((c) => c.section !== 'radio');
      const updated = [...nonRadio, ...radioChs];
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_CHANNELS, JSON.stringify(updated.slice(0, 1000)));
      } catch {}
      return updated;
    });

    if (!activeChannel || activeChannel.section === 'radio') {
      const matched = radioChs.find((c) => c.id === activeChannel?.id) || radioChs[0];
      if (matched && (matched.name !== activeChannel?.name || matched.sources !== activeChannel?.sources)) {
        setActiveChannel(matched);
      }
    }
  }, [activeSection, activePlaylistId]);

  const currentCategoryTitle = useMemo(() => {
    if (activeSection === 'fav') return 'المفضلة المحفوظة';
    if (activeSection === 'history') return 'سجل المشاهدة الأخيرة';
    if (selectedCategoryId === 'ALL') {
      if (activeSection === 'live') return 'كل القنوات المباشرة';
      if (activeSection === 'radio') return 'إذاعات الراديو والقرآن الكريم';
      if (activeSection === 'movies') return 'كل الأفلام (VOD)';
      return 'كل المسلسلات والحلقات';
    }
    const foundCat =
      categories.find((c) => c.id === selectedCategoryId) ||
      ARABIC_RADIO_CATEGORIES.find((c) => c.id === selectedCategoryId);
    return foundCat?.name || 'الكل';
  }, [activeSection, selectedCategoryId, categories]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#070b14] text-slate-100 select-none">
      {/* Top Header: Clean, strictly App Brand on one side and About button on the other side */}
      <header className="flex items-center justify-between px-5 py-2.5 bg-[#0a101f]/95 border-b border-white/8 shrink-0">
        {/* App Brand & Logo with new light 3D TV Icon */}
        <div
          onClick={() => setIsSplashOpen(true)}
          className="flex items-center gap-2.5 cursor-pointer group"
          title="عرض شاشة البداية والترحيب التفاعلية (Splash Screen)"
        >
          <div className="w-8 h-8 rounded-xl p-0.5 bg-linear-to-tr from-cyan-400 via-teal-300 to-emerald-400 shadow-md shadow-cyan-500/25 group-hover:shadow-cyan-400/40 transition-all">
            <img
              src="/assets/icons/app_icon.png"
              alt="ARN"
              className="w-full h-full object-contain rounded-[10px]"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-tight text-white whitespace-nowrap group-hover:text-cyan-300 transition-colors">
              ARN IPTV Pro
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold leading-none">
              ARN Technology
            </span>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Interactive Splash Screen Trigger Button */}
          <button
            type="button"
            onClick={() => setIsSplashOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
            title="عرض شاشة البداية والترحيب التفاعلية"
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">شاشة البداية</span>
          </button>

          {/* About Button */}
          <button
            type="button"
            onClick={() => setIsAboutModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
            title="حول البرنامج وحقوق الملكية"
          >
            <Info className="w-4 h-4 text-emerald-400" />
            <span>حول البرنامج</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden p-2.5 gap-2.5 relative">
        {/* Slim Sidebar (Navigation & Controls) */}
        <aside className="w-20 bg-[#0f172a]/90 border border-white/8 rounded-xl flex flex-col items-center justify-between py-3 shrink-0">
          <div className="flex flex-col items-center gap-1.5 w-full px-1.5">
            <button
              type="button"
              onClick={() => setActiveSection('live')}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                activeSection === 'live'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              <Tv className="w-4 h-4" />
              <span className="whitespace-nowrap">البث</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('radio')}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                activeSection === 'radio'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span className="whitespace-nowrap">الراديو</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('movies')}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                activeSection === 'movies'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              <Film className="w-4 h-4" />
              <span className="whitespace-nowrap">الأفلام</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('series')}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                activeSection === 'series'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span className="whitespace-nowrap">المسلسلات</span>
            </button>

            {/* Categories Fold / Expand Button */}
            <button
              type="button"
              onClick={() => setIsCategoriesOpen((prev) => !prev)}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                isCategoriesOpen
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
              title="عرض أو إخفاء قائمة التصنيفات"
            >
              <FolderOpen className="w-4 h-4" />
              <span className="whitespace-nowrap">التصنيفات</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('fav')}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                activeSection === 'fav'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              <Star className="w-4 h-4" />
              <span className="whitespace-nowrap">المفضلة</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('history')}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                activeSection === 'history'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              <History className="w-4 h-4" />
              <span className="whitespace-nowrap">الأخيرة</span>
            </button>
          </div>

          <div className="flex flex-col items-center gap-1.5 w-full px-1.5 pt-2 border-t border-white/8">
            <button
              id="btnPlaylists"
              type="button"
              onClick={() => setIsPlaylistModalOpen(true)}
              className="w-full flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-[11px] font-semibold text-slate-300 hover:text-emerald-400 hover:bg-white/5 transition-colors cursor-pointer"
              title="إدارة القوائم وأكواد FG"
            >
              <ListPlus className="w-4 h-4" />
              <span className="whitespace-nowrap">القوائم</span>
            </button>

            <button
              id="btnAbout"
              type="button"
              onClick={() => setIsAboutModalOpen(true)}
              className="w-full flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="حول البرنامج"
            >
              <Info className="w-4 h-4" />
              <span className="whitespace-nowrap">حول</span>
            </button>
          </div>
        </aside>

        {/* Collapsible Categories Panel: Folds/unfolds when clicking "التصنيفات" */}
        {isCategoriesOpen && (
          <section className="w-64 lg:w-72 bg-[#0f172a]/95 border border-white/10 rounded-xl flex flex-col overflow-hidden shrink-0 shadow-2xl z-20 animate-in fade-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white">التصنيفات</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  {visibleCategories.length} {activeSection === 'radio' ? 'تصنيفات' : 'فئة'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsCategoriesOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="إغلاق قائمة التصنيفات"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-2.5 border-b border-white/8">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="catSearchInput"
                  type="text"
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  placeholder="بحث في التصنيفات..."
                  className="w-full bg-[#070b14] border border-white/10 rounded-lg pr-8 pl-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60"
                />
              </div>
            </div>

            <div id="categoriesList" className="flex-1 overflow-y-auto p-2 space-y-1">
              {/* All Channels Option */}
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId('ALL');
                  setIsCategoriesOpen(false); // Collapses categories and displays channels!
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedCategoryId === 'ALL'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate">
                    {activeSection === 'radio' ? 'الكل (جميع الإذاعات)' : 'الكل (جميع القنوات)'}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums shrink-0 mr-1">
                  {
                    channels.filter((c) =>
                      activeSection === 'radio'
                        ? c.section === 'radio'
                        : c.playlistId === activePlaylistId &&
                          (activeSection === 'fav'
                            ? favoriteIds.includes(c.id)
                            : activeSection === 'history'
                            ? historyIds.includes(c.id)
                            : c.section === activeSection)
                    ).length
                  }
                </span>
              </button>

              {visibleCategories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                const visual = getCategoryVisual(cat.name, cat.remoteTopic, cat.icon, cat.flag);

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(cat.id);
                      setIsCategoriesOpen(false); // Collapses categories and displays channels!
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {visual?.type === 'icon' ? (
                        <div className="w-8 h-4.5 rounded overflow-hidden shrink-0 border border-white/10 shadow-sm flex items-center justify-center bg-black/40">
                          <img
                            src={visual.src}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : visual?.type === 'flag' ? (
                        <div className="w-6 h-4 rounded overflow-hidden shrink-0 border border-white/15 shadow-sm bg-black/40">
                          <img
                            src={visual.src}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <FolderOpen className="w-4 h-4 text-emerald-400/80 shrink-0" />
                      )}
                      <span className="truncate text-right">{cat.name}</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums shrink-0 mr-1">
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Playlist Switcher Footer */}
            {playlists.length > 0 && (
              <div className="p-2.5 bg-[#070b14]/80 border-t border-white/8 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-400">القائمة النشطة:</div>
                  <div className="text-xs font-bold text-emerald-400 truncate">
                    {playlists.find((p) => p.id === activePlaylistId)?.name || 'افتراضي'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPlaylistModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-[11px] font-semibold text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  تغيير
                </button>
              </div>
            )}
          </section>
        )}

        {/* Channels List Panel */}
        <section className="w-80 lg:w-96 bg-[#0f172a]/85 border border-white/8 rounded-xl flex flex-col overflow-hidden shrink-0">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
            {/* Current Category & Toggle Categories Button */}
            <div className="flex items-center gap-2 min-w-0">
              <Radio className="w-4 h-4 text-sky-400 shrink-0" />
              <button
                type="button"
                onClick={() => setIsCategoriesOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white truncate transition-colors cursor-pointer"
                title="اضغط لاختيار تصنيف آخر"
              >
                <span className="truncate max-w-32.5">{currentCategoryTitle}</span>
                <ChevronDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              </button>
            </div>
            <span id="chCountBadge" className="text-xs font-mono text-slate-400 tabular-nums shrink-0">
              {visibleChannels.length} {activeSection === 'radio' ? 'إذاعة' : 'قناة'}
            </span>
          </div>

          {/* Search & Favorites Filter Toolbar */}
          <div className="p-2.5 border-b border-white/8 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="chSearchInput"
                type="text"
                value={chSearch}
                onChange={(e) => setChSearch(e.target.value)}
                placeholder={activeSection === 'radio' ? 'ابحث عن إذاعة راديو...' : 'ابحث عن قناة...'}
                className="w-full bg-[#070b14] border border-white/10 rounded-lg pr-8 pl-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
            </div>
            <button
              id="btnFavFilter"
              type="button"
              onClick={() => setOnlyFavFilter((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                onlyFavFilter
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-[#070b14] border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              ★ المفضلة
            </button>
          </div>

          {/* Channels Scroll List */}
          <div id="channelsList" className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {loadingCategoryId === selectedCategoryId ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-300 space-y-3">
                <div className="w-7 h-7 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-bold text-emerald-300">
                  جاري جلب قنوات «{currentCategoryTitle}» الحية...
                </p>
                <p className="text-[11px] text-slate-400">
                  فك تشفير AES-128-CBC ومزامنة القنوات المباشرة
                </p>
              </div>
            ) : playlists.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
                <Radio className="w-10 h-10 text-slate-600" />
                <p className="text-xs font-bold text-slate-200">التطبيق نظيف وجاهز للتشغيل</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  أدخل كود دراما لايف (FG Code) أو أضف رابط قائمة M3U لبدء تحميل القنوات.
                </p>
                <button
                  type="button"
                  onClick={() => setIsPlaylistModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer shadow-md shadow-emerald-500/20"
                >
                  إضافة كود أو قائمة تشغيل
                </button>
              </div>
            ) : visibleChannels.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
                <Tv className="w-8 h-8 text-slate-600" />
                <p className="text-xs font-semibold">لا توجد قنوات مطابقة للفلتر الحالي</p>
                <button
                  type="button"
                  onClick={() => {
                    setChSearch('');
                    setOnlyFavFilter(false);
                    setSelectedCategoryId('ALL');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/25 cursor-pointer"
                >
                  إعادة ضبط الفلاتر
                </button>
              </div>
            ) : (
              visibleChannels.map((ch, idx) => {
                const isPlayingNow = activeChannel?.id === ch.id;
                const isFav = favoriteIds.includes(ch.id);
                const hasProxyK9x = ch.sources.some((s) => s.hasK9xSwap);

                return (
                  <div
                    key={ch.id}
                    onClick={() => setActiveChannel(ch)}
                    className={`group flex items-center justify-between gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      isPlayingNow
                        ? 'bg-emerald-500/15 border-emerald-500/45 shadow-sm'
                        : 'bg-[#070b14]/60 border-white/6 hover:border-white/15 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Channel Number / Play Indicator */}
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold tabular-nums shrink-0 ${
                          isPlayingNow
                            ? 'bg-emerald-500 text-slate-950 shadow-sm'
                            : 'bg-[#0f172a] text-slate-400 group-hover:text-white'
                        }`}
                      >
                        {isPlayingNow ? <Play className="w-3.5 h-3.5 fill-current" /> : idx + 1}
                      </div>

                      {/* Channel Logo / Icon */}
                      <div className="w-10 h-10 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-sm relative group-hover:border-emerald-500/30 transition-colors">
                        {ch.logo ? (
                          <img
                            src={ch.logo}
                            alt={ch.name}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              const fallback = parent?.querySelector('.logo-fallback') as HTMLElement | null;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div
                          className={`logo-fallback items-center justify-center w-full h-full text-slate-400 ${
                            ch.logo ? 'hidden' : 'flex'
                          }`}
                        >
                          {ch.section === 'radio' ? (
                            <Radio className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Tv className="w-4 h-4 text-emerald-400/70" />
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-100 truncate">{ch.name}</div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate mt-0.5">
                          <span className="truncate">{ch.groupTitle}</span>
                          {ch.resolution && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono text-sky-400 tabular-nums" dir="ltr">
                                {ch.resolution}
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{ch.sources.length} سيرفر</span>
                          {hasProxyK9x && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-0.5 text-emerald-400 font-mono">
                                <ShieldCheck className="w-3 h-3" />
                                FG
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Favorite Star Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(ch.id);
                      }}
                      className={`p-1.5 rounded-lg transition-colors shrink-0 cursor-pointer ${
                        isFav
                          ? 'text-amber-400 hover:bg-amber-500/15'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-white/8'
                      }`}
                      title={isFav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
                    >
                      <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Column 3: Interactive HLS.js Video Player Container */}
        <HlsVideoPlayer
          channel={activeChannel}
          categoryChannels={visibleChannels}
          categoryTitle={currentCategoryTitle}
          onSelectChannel={(ch) => setActiveChannel(ch)}
          onChannelWatched={handleChannelWatched}
          onServersLoaded={handleServersLoaded}
          onOpenPlaylistModal={() => setIsPlaylistModalOpen(true)}
        />
      </div>

      {/* Modals */}
      <PlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        playlists={playlists}
        activePlaylistId={activePlaylistId}
        onSelectPlaylist={(id) => {
          setActivePlaylistId(id);
          const firstCh = channels.find((c) => c.playlistId === id);
          if (firstCh) setActiveChannel(firstCh);
        }}
        onDeletePlaylist={handleDeletePlaylist}
        onImportSuccess={handleImportSuccess}
      />

      <AboutModal isOpen={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} />

      {/* Interactive Splash Screen */}
      <SplashScreen isOpen={isSplashOpen} onClose={() => setIsSplashOpen(false)} />
    </div>
  );
}
