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
  Moon,
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
import { loadCatalogFromIdb, saveCatalogToIdb } from './utils/catalogStorage';
import { ARABIC_RADIO_CATEGORIES, ARABIC_RADIO_CHANNELS } from './server/arabicRadioCatalog';
import { getEgyptianChannels } from './server/egyptCatalog';

// Storage keys for a clean, user-driven IPTV experience (no default mock data)
const STORAGE_KEYS = {
  FAVORITES: 'arn_iptv_clean_v5_favorites',
  HISTORY: 'arn_iptv_clean_v5_history',
  CUSTOM_PLAYLISTS: 'arn_iptv_clean_v5_playlists',
  CUSTOM_CATEGORIES: 'arn_iptv_clean_v5_categories',
  CUSTOM_CHANNELS: 'arn_iptv_clean_v5_channels',
  DEEP_BLACK_OLED: 'arn_iptv_deep_black_oled',
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

  // True Night Mode / OLED Deep Black Mode (#000000) state
  const [isDeepBlackMode, setIsDeepBlackMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.DEEP_BLACK_OLED) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('oled-black', isDeepBlackMode);
    try {
      localStorage.setItem(STORAGE_KEYS.DEEP_BLACK_OLED, isDeepBlackMode ? 'true' : 'false');
    } catch {}
  }, [isDeepBlackMode]);

  const toggleDeepBlackMode = () => {
    setIsDeepBlackMode((prev) => !prev);
  };

  // Hydrate full catalog from IndexedDB on startup (restores >1,000 channels if stored)
  useEffect(() => {
    let active = true;
    Promise.all([
      loadCatalogFromIdb<PlaylistSource>('playlists'),
      loadCatalogFromIdb<CategoryItem>('categories'),
      loadCatalogFromIdb<ChannelItem>('channels'),
    ])
      .then(([idbPlaylists, idbCategories, idbChannels]) => {
        if (!active) return;
        if (idbPlaylists && idbPlaylists.length > 0) {
          setPlaylists(idbPlaylists);
          setActivePlaylistId((prev) => prev || idbPlaylists[0].id);
        }
        if (idbCategories && idbCategories.length > 0) {
          setCategories(idbCategories);
        }
        if (idbChannels && idbChannels.length > 0) {
          setChannels((prev) => (idbChannels.length >= prev.length ? idbChannels : prev));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

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
      saveCatalogToIdb('playlists', updated);
      return updated;
    });

    setCategories((prev) => {
      const filtered = prev.filter((c) => c.playlistId !== newPlaylist.id);
      const updated = [...filtered, ...newCategories];
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_CATEGORIES, JSON.stringify(updated));
      } catch {}
      saveCatalogToIdb('categories', updated);
      return updated;
    });

    setChannels((prev) => {
      const filtered = prev.filter((ch) => ch.playlistId !== newPlaylist.id);
      const updated = [...filtered, ...newChannels];
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_CHANNELS, JSON.stringify(updated.slice(0, 1000)));
      } catch {}
      saveCatalogToIdb('channels', updated);
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
      saveCatalogToIdb('playlists', updated);
      return updated;
    });
    setCategories((prev) => {
      const updated = prev.filter((c) => c.playlistId !== playlistId);
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_CATEGORIES, JSON.stringify(updated));
      } catch {}
      saveCatalogToIdb('categories', updated);
      return updated;
    });
    setChannels((prev) => {
      const updated = prev.filter((ch) => ch.playlistId !== playlistId);
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_CHANNELS, JSON.stringify(updated.slice(0, 1000)));
      } catch {}
      saveCatalogToIdb('channels', updated);
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
      {/* Top Header: Clean 1-row Apple TV / B&O Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-5 py-2.5 bg-[#0a101f]/90 backdrop-blur-xl border-b border-white/[0.06] shrink-0">
        {/* Zone 1: Clean Single-Line Brand Wordmark & Anodized Icon */}
        <div
          onClick={() => setIsSplashOpen(true)}
          className="flex items-center gap-2.5 cursor-pointer group shrink-0"
          title="عرض شاشة البداية والترحيب التفاعلية"
        >
          <div className="w-7 h-7 rounded-lg p-1 bg-white/[0.04] border border-white/[0.08] group-hover:border-white/[0.18] transition-colors flex items-center justify-center">
            <img
              src="/assets/icons/app_icon.png"
              alt="ARN"
              className="w-full h-full object-contain rounded-[6px]"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-100 whitespace-nowrap group-hover:text-white transition-colors">
            ARN IPTV Pro
          </span>
        </div>

        {/* Zone 3: Primary Workspace Controls (Single-Line, No Decorative Clutter) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Deep Black Mode (OLED True Night Mode) Quick Toggle Switch */}
          <button
            id="btnDeepBlackToggle"
            type="button"
            role="switch"
            aria-checked={isDeepBlackMode}
            onClick={toggleDeepBlackMode}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
              isDeepBlackMode
                ? 'bg-white/[0.08] text-white border-white/20'
                : 'text-slate-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.07]'
            }`}
            title="تفعيل أو إيقاف الوضع الليلي الحقيقي (Deep Black Mode) لتقليل استهلاك الطاقة على شاشات OLED وراحة العين"
          >
            <Moon className={`w-3.5 h-3.5 ${isDeepBlackMode ? 'text-emerald-400 fill-current' : 'text-slate-400'}`} />
            <span className="hidden md:inline">الوضع الليلي الحقيقي</span>
            <span
              className={`w-7 h-4 rounded-full p-0.5 flex items-center transition-colors ${
                isDeepBlackMode ? 'bg-emerald-500 justify-start' : 'bg-white/15 justify-end'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
            </span>
          </button>

          {/* Interactive Splash Screen Trigger Button */}
          <button
            type="button"
            onClick={() => setIsSplashOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="عرض شاشة البداية والترحيب التفاعلية"
          >
            <Tv className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">شاشة الترحيب</span>
          </button>

          {/* About Button */}
          <button
            type="button"
            onClick={() => setIsAboutModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="حول البرنامج وحقوق الملكية"
          >
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>حول البرنامج</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden p-2.5 gap-2.5 relative">
        {/* Tactile Navigation Rail (Apple TV / B&O Minimal Sidebar) */}
        <aside className="w-20 bg-[#0f172a]/75 backdrop-blur-xl border border-white/[0.06] rounded-2xl flex flex-col items-center justify-between py-3 shrink-0">
          <div className="flex flex-col items-center gap-1 w-full px-1.5">
            <button
              type="button"
              onClick={() => setActiveSection('live')}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-[10px] text-[11px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                activeSection === 'live'
                  ? 'bg-white/[0.09] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <Tv className={`w-4 h-4 ${activeSection === 'live' ? 'text-emerald-400' : ''}`} />
              <span>البث</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('radio')}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-[10px] text-[11px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                activeSection === 'radio'
                  ? 'bg-white/[0.09] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <Radio className={`w-4 h-4 ${activeSection === 'radio' ? 'text-emerald-400' : ''}`} />
              <span>الراديو</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('movies')}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-[10px] text-[11px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                activeSection === 'movies'
                  ? 'bg-white/[0.09] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <Film className={`w-4 h-4 ${activeSection === 'movies' ? 'text-emerald-400' : ''}`} />
              <span>الأفلام</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('series')}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-[10px] text-[11px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                activeSection === 'series'
                  ? 'bg-white/[0.09] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <Layers className={`w-4 h-4 ${activeSection === 'series' ? 'text-emerald-400' : ''}`} />
              <span>المسلسلات</span>
            </button>

            {/* Categories Fold / Expand Button */}
            <button
              type="button"
              onClick={() => setIsCategoriesOpen((prev) => !prev)}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-[10px] text-[11px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                isCategoriesOpen
                  ? 'bg-white/[0.11] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
              title="عرض أو إخفاء قائمة التصنيفات"
            >
              <FolderOpen className={`w-4 h-4 ${isCategoriesOpen ? 'text-emerald-400' : ''}`} />
              <span>التصنيفات</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('fav')}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-[10px] text-[11px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                activeSection === 'fav'
                  ? 'bg-white/[0.09] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <Star className={`w-4 h-4 ${activeSection === 'fav' ? 'text-emerald-400' : ''}`} />
              <span>المفضلة</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('history')}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-[10px] text-[11px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                activeSection === 'history'
                  ? 'bg-white/[0.09] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <History className={`w-4 h-4 ${activeSection === 'history' ? 'text-emerald-400' : ''}`} />
              <span>الأخيرة</span>
            </button>
          </div>

          <div className="flex flex-col items-center gap-1 w-full px-1.5 pt-2 border-t border-white/[0.06]">
            <button
              id="btnPlaylists"
              type="button"
              onClick={() => setIsPlaylistModalOpen(true)}
              className="w-full flex flex-col items-center gap-1 py-2 px-1 rounded-[10px] text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer whitespace-nowrap"
              title="إدارة القوائم وأكواد FG"
            >
              <ListPlus className="w-4 h-4 text-emerald-400" />
              <span>القوائم</span>
            </button>

            <button
              id="btnAbout"
              type="button"
              onClick={() => setIsAboutModalOpen(true)}
              className="w-full flex flex-col items-center gap-1 py-2 px-1 rounded-[10px] text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer whitespace-nowrap"
              title="حول البرنامج"
            >
              <Info className="w-4 h-4" />
              <span>حول</span>
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

        {/* Channels List Panel (Apple TV / B&O Seamless Editorial List) */}
        <section className="w-80 lg:w-96 bg-[#0f172a]/75 backdrop-blur-xl border border-white/[0.06] rounded-2xl flex flex-col overflow-hidden shrink-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            {/* Current Category & Toggle Categories Button */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setIsCategoriesOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-xs font-semibold text-slate-100 truncate transition-colors cursor-pointer"
                title="اضغط لاختيار تصنيف آخر"
              >
                <span className="truncate max-w-36">{currentCategoryTitle}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
            </div>
            <span id="chCountBadge" className="text-xs font-mono text-slate-400 tabular-nums shrink-0">
              {visibleChannels.length} {activeSection === 'radio' ? 'إذاعة' : 'قناة'}
            </span>
          </div>

          {/* Search & Favorites Filter Toolbar */}
          <div className="p-2.5 border-b border-white/[0.06] flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="chSearchInput"
                type="text"
                value={chSearch}
                onChange={(e) => setChSearch(e.target.value)}
                placeholder={activeSection === 'radio' ? 'ابحث عن إذاعة راديو...' : 'ابحث عن قناة...'}
                className="w-full bg-[#070b14]/80 border border-white/[0.07] rounded-lg pr-8 pl-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-white/25 transition-colors"
              />
            </div>
            <button
              id="btnFavFilter"
              type="button"
              onClick={() => setOnlyFavFilter((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                onlyFavFilter
                  ? 'bg-white/[0.1] border-white/20 text-amber-300'
                  : 'bg-[#070b14]/80 border-white/[0.07] text-slate-400 hover:text-slate-200'
              }`}
            >
              ★ المفضلة
            </button>
          </div>

          {/* Channels Scroll List (Borderless Seamless Rows) */}
          <div id="channelsList" className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {loadingCategoryId === selectedCategoryId ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-300 space-y-3">
                <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-semibold text-slate-200">
                  جاري جلب قنوات «{currentCategoryTitle}» الحية...
                </p>
                <p className="text-[11px] text-slate-400">
                  فك تشفير AES-128-CBC ومزامنة القنوات المباشرة
                </p>
              </div>
            ) : playlists.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
                <Radio className="w-9 h-9 text-slate-600" />
                <p className="text-xs font-semibold text-slate-200">التطبيق نظيف وجاهز للتشغيل</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  أدخل كود دراما لايف (FG Code) أو أضف رابط قائمة M3U لبدء تحميل القنوات.
                </p>
                <button
                  type="button"
                  onClick={() => setIsPlaylistModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
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
                  className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-slate-200 text-xs font-semibold hover:bg-white/[0.1] cursor-pointer"
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
                    className={`group flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-[10px] cursor-pointer transition-colors duration-150 ${
                      isPlayingNow
                        ? 'bg-white/[0.09] text-white'
                        : 'hover:bg-white/[0.04] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Channel Number / Play Indicator */}
                      <div
                        className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-mono font-semibold tabular-nums shrink-0 transition-colors ${
                          isPlayingNow
                            ? 'bg-emerald-500 text-slate-950'
                            : 'text-slate-500 group-hover:text-slate-300'
                        }`}
                      >
                        {isPlayingNow ? <Play className="w-3 h-3 fill-current" /> : idx + 1}
                      </div>

                      {/* Channel Logo / Icon */}
                      <div className="w-9 h-9 rounded-lg bg-black/40 border border-white/[0.07] flex items-center justify-center p-1 overflow-hidden shrink-0 relative">
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
                            <Radio className="w-4 h-4 text-slate-400" />
                          ) : (
                            <Tv className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-semibold truncate ${isPlayingNow ? 'text-white' : 'text-slate-200'}`}>
                          {ch.name}
                        </div>
                        {/* Zero-Pill Unboxed Metadata with Typographic Separators */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate mt-0.5">
                          <span className="truncate">{ch.groupTitle}</span>
                          {ch.resolution && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono text-slate-300 tabular-nums" dir="ltr">
                                {ch.resolution}
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{ch.sources.length} سيرفر</span>
                          {hasProxyK9x && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono text-emerald-400/90">FG</span>
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
                          ? 'text-amber-400 hover:bg-white/[0.06]'
                          : 'text-slate-600 opacity-0 group-hover:opacity-100 hover:text-slate-300 hover:bg-white/[0.06]'
                      }`}
                      title={isFav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
                    >
                      <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
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
        isDeepBlackMode={isDeepBlackMode}
        onToggleDeepBlackMode={toggleDeepBlackMode}
      />

      <AboutModal isOpen={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} />

      {/* Interactive Splash Screen */}
      <SplashScreen isOpen={isSplashOpen} onClose={() => setIsSplashOpen(false)} />
    </div>
  );
}
