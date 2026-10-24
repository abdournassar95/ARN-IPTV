'use strict';

/**
 * ARN IPTV Pro — Main Renderer Application Controller
 * Copyright © 2026 عبده رجب نصار — شركة ARN Technology
 */

(function initArnIptvApp() {
  const state = {
    currentPage: 'live', // 'live' | 'movies' | 'series' | 'fav' | 'history'
    activePlaylistId: 0,
    playlists: [],
    selectedCategoryId: 'all',
    selectedCategoryTitle: '🌐 الكل',
    searchQuery: '',
    favOnlyFilter: false,
    qualityFilter: 'all',
    currentChannels: [],
    playingIndex: -1,
    appStatus: null
  };

  // Toast helper
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const item = document.createElement('div');
    item.className = `toast-item ${type}`;
    item.textContent = message;
    container.appendChild(item);
    setTimeout(() => {
      item.style.opacity = '0';
      item.style.transition = 'opacity 0.25s ease';
      setTimeout(() => item.remove(), 260);
    }, 3400);
  }

  // Instantiate Player & Virtual Catalog View
  const player = new window.ArnVideoPlayer({
    onPrevChannel: () => stepChannel(-1),
    onNextChannel: () => stepChannel(1),
    onToast: showToast
  });

  const catalog = new window.ArnCatalogView({
    onSelectCategory: (catId, catTitle) => {
      state.selectedCategoryId = catId;
      state.selectedCategoryTitle = catTitle;
      document.getElementById('currentCatTitle').textContent = catTitle;
      loadChannelsForCurrentState();
    },
    onSelectChannel: (channel, idx) => {
      handleChannelActivated(channel, idx);
    },
    onToggleFavorite: async (channelId) => {
      try {
        const res = await window.api.toggleFavorite(channelId);
        catalog.updateChannelFavoriteState(channelId, res.isFavorite);
        showToast(
          res.isFavorite ? '⭐ تمت الإضافة إلى المفضلة' : 'تمت الإزالة من المفضلة'
        );
        refreshStatsBadges();
        if (state.currentPage === 'fav' || state.favOnlyFilter) {
          loadChannelsForCurrentState(false);
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  function mapPageToContentType(page) {
    if (page === 'movies') return 'movie';
    if (page === 'series') return 'series';
    if (page === 'fav') return 'fav';
    if (page === 'history') return 'history';
    return 'live';
  }

  function stepChannel(delta) {
    if (!state.currentChannels.length) return;
    let nextIdx = state.playingIndex + delta;
    if (nextIdx < 0) nextIdx = state.currentChannels.length - 1;
    if (nextIdx >= state.currentChannels.length) nextIdx = 0;
    const ch = state.currentChannels[nextIdx];
    if (ch) handleChannelActivated(ch, nextIdx);
  }

  function handleChannelActivated(channel, idx) {
    state.playingIndex = idx;
    catalog.setActiveChannel(channel.id);

    const drawer = document.getElementById('seriesEpisodesDrawer');
    if (channel.contentType === 'series' && Array.isArray(channel.meta?.episodes) && channel.meta.episodes.length > 0) {
      openSeriesDrawer(channel);
      player.loadChannel(channel, channel.meta.episodes[0]);
    } else {
      drawer.classList.add('hidden');
      player.loadChannel(channel);
    }

    setTimeout(() => refreshStatsBadges(), 350);
  }

  function openSeriesDrawer(seriesChannel) {
    const drawer = document.getElementById('seriesEpisodesDrawer');
    const titleEl = document.getElementById('seriesDrawerTitle');
    const plotEl = document.getElementById('seriesDrawerPlot');
    const listEl = document.getElementById('seriesEpisodesList');

    titleEl.textContent = `🗂️ ${seriesChannel.name}`;
    plotEl.textContent = seriesChannel.meta?.plot || 'اختر الحلقة لبدء المشاهدة الفورية';
    listEl.innerHTML = '';

    const episodes = seriesChannel.meta?.episodes || [];
    episodes.forEach((ep, idx) => {
      const btn = document.createElement('button');
      btn.className = `ep-btn ${idx === 0 ? 'active' : ''}`;
      btn.textContent = `▶ ${ep.title}`;
      btn.onclick = () => {
        listEl.querySelectorAll('.ep-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        player.loadChannel(seriesChannel, ep);
      };
      listEl.appendChild(btn);
    });

    drawer.classList.remove('hidden');
  }

  async function refreshStatsBadges() {
    try {
      const status = await window.api.getAppStatus();
      state.appStatus = status;
      const st = status.stats || {};

      document.getElementById('navBadgeLive').textContent = (st.liveCount || 0).toLocaleString('en-US');
      document.getElementById('navBadgeMovies').textContent = (st.movieCount || 0).toLocaleString('en-US');
      document.getElementById('navBadgeSeries').textContent = (st.seriesCount || 0).toLocaleString('en-US');
      document.getElementById('navBadgeFav').textContent = (st.favCount || 0).toLocaleString('en-US');
      document.getElementById('navBadgeHistory').textContent = (st.historyCount || 0).toLocaleString('en-US');

      const proxyTxt = document.getElementById('proxyStatusText');
      if (proxyTxt) {
        proxyTxt.textContent = status.runtime === 'electron'
          ? `البروكسي نشط :${status.proxyPort || 39871}`
          : 'البروكسي والمحرك متصلان';
      }

      renderDiagnostics(status);
    } catch (_e) {}
  }

  function renderDiagnostics(status) {
    const grid = document.getElementById('diagGrid');
    if (!grid || !status) return;
    const st = status.stats || {};
    grid.innerHTML = `
      <div class="diag-cell"><span>محرك قاعدة البيانات</span><strong>${st.engine || 'better-sqlite3'}</strong></div>
      <div class="diag-cell"><span>بوابة البروكسي المحلي</span><strong class="mono-txt">${status.proxyBase || '127.0.0.1:39871'}</strong></div>
      <div class="diag-cell"><span>إجمالي العناصر المفهرسة</span><strong class="mono-txt">${(st.totalItems || 0).toLocaleString('en-US')}</strong></div>
      <div class="diag-cell"><span>محرك التشفير</span><strong>AES-128-CBC + k9x_ Swap</strong></div>
    `;
  }

  async function loadPlaylistsIntoUI() {
    const playlists = await window.api.loadPlaylists();
    state.playlists = playlists || [];

    const active = state.playlists.find((p) => p.is_active === 1) || state.playlists[0];
    state.activePlaylistId = active ? Number(active.id) : 0;

    // Header select
    const sel = document.getElementById('headerPlaylistSelect');
    sel.innerHTML = '';
    if (state.playlists.length === 0) {
      const opt = document.createElement('option');
      opt.value = '0';
      opt.textContent = 'لا توجد قوائم';
      sel.appendChild(opt);
    } else {
      state.playlists.forEach((pl) => {
        const opt = document.createElement('option');
        opt.value = String(pl.id);
        opt.textContent = `${pl.name} (${Number(pl.channel_count || 0).toLocaleString('en-US')})`;
        if (pl.id === state.activePlaylistId) opt.selected = true;
        sel.appendChild(opt);
      });
    }

    renderSavedPlaylistsModalList();
  }

  function renderSavedPlaylistsModalList() {
    const box = document.getElementById('savedPlaylistsContainer');
    if (!box) return;
    box.innerHTML = '';

    if (state.playlists.length === 0) {
      box.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:18px;">لا توجد قوائم محفوظة حالياً.</p>';
      return;
    }

    state.playlists.forEach((pl) => {
      const row = document.createElement('div');
      row.className = `saved-pl-item ${pl.is_active === 1 ? 'active' : ''}`;
      const badgeMap = {
        fg: 'Drama Live FG',
        m3u_url: 'M3U URL',
        m3u_file: 'ملف M3U',
        m3u_text: 'M3U مخصص',
        xtream: 'Xtream API',
        demo: 'رسمي مدمج',
        benchmark: '50K Benchmark'
      };
      row.innerHTML = `
        <div class="saved-pl-meta">
          <h4>${pl.is_active === 1 ? '🟢 ' : ''}${escapeText(pl.name)}</h4>
          <p>
            <span>${badgeMap[pl.type] || pl.type}</span> •
            <span>📺 ${Number(pl.live_count || 0).toLocaleString('en-US')} قناة</span> •
            <span>🎬 ${Number(pl.movie_count || 0)} فيلم</span> •
            <span>🗂️ ${Number(pl.series_count || 0)} مسلسل</span>
          </p>
        </div>
        <div class="saved-pl-btns">
          ${pl.is_active === 1 ? '' : `<button class="btn-glass btn-act-pl" data-id="${pl.id}">تفعيل</button>`}
          <button class="btn-mini-danger btn-del-pl" data-id="${pl.id}">حذف</button>
        </div>
      `;
      box.appendChild(row);
    });

    box.querySelectorAll('.btn-act-pl').forEach((btn) => {
      btn.onclick = async () => {
        await window.api.setActivePlaylist(Number(btn.dataset.id));
        await reloadAllData();
        showToast('✅ تم التبديل إلى القائمة المحددة');
      };
    });

    box.querySelectorAll('.btn-del-pl').forEach((btn) => {
      btn.onclick = async () => {
        await window.api.deletePlaylist(Number(btn.dataset.id));
        await reloadAllData();
        showToast('🗑️ تم حذف القائمة');
      };
    });
  }

  function escapeText(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  async function loadCategoriesAndChannels() {
    const contentType = mapPageToContentType(state.currentPage);
    const catData = await window.api.getCategories({
      playlistId: state.activePlaylistId,
      contentType
    });

    state.selectedCategoryId = 'all';
    const pageTitles = {
      live: '🌐 جميع القنوات المباشرة',
      movies: '🎬 جميع الأفلام',
      series: '🗂️ جميع المسلسلات',
      fav: '⭐ قائمتي المفضلة',
      history: '⏱️ سجل المشاهدة الأخير'
    };
    state.selectedCategoryTitle = pageTitles[state.currentPage] || '🌐 الكل';
    document.getElementById('currentCatTitle').textContent = state.selectedCategoryTitle;
    document.getElementById('btnClearHistory').classList.toggle('hidden', state.currentPage !== 'history');
    document.getElementById('seriesEpisodesDrawer').classList.add('hidden');

    catalog.setCategoriesData(catData, 'all');
    await loadChannelsForCurrentState(true);
  }

  async function loadChannelsForCurrentState(resetScroll = true) {
    const contentType = mapPageToContentType(state.currentPage);
    const res = await window.api.getChannels({
      playlistId: state.activePlaylistId,
      contentType,
      categoryId: state.selectedCategoryId === 'all' ? null : state.selectedCategoryId,
      search: state.searchQuery,
      favoritesOnly: state.favOnlyFilter,
      historyOnly: state.currentPage === 'history',
      quality: state.qualityFilter,
      limit: 55000
    });

    state.currentChannels = res.items || [];
    catalog.setChannels(state.currentChannels, state.currentPage, resetScroll);
  }

  async function reloadAllData() {
    await loadPlaylistsIntoUI();
    await refreshStatsBadges();
    await loadCategoriesAndChannels();
  }

  // Modal helpers
  function openModal(modalId) {
    document.getElementById(modalId)?.classList.remove('hidden');
  }
  function closeModal(modalId) {
    document.getElementById(modalId)?.classList.add('hidden');
  }

  // Progress Bar UI during Import
  function setImportProgress(visible, percent = 0, text = '') {
    const box = document.getElementById('importProgressBox');
    if (!box) return;
    box.classList.toggle('hidden', !visible);
    if (visible) {
      document.getElementById('importProgressPct').textContent = `${Math.round(percent)}%`;
      document.getElementById('importProgressFill').style.width = `${Math.min(100, Math.max(0, percent))}%`;
      document.getElementById('importProgressText').textContent = text || 'جاري المعالجة...';
    }
  }

  // Resizable 3-Column Splitters (RTL Aware!)
  function setupColumnSplitters() {
    function makeResizable(handleEl, panelEl, minW, maxW) {
      let startX = 0;
      let startWidth = 0;

      const onMouseMove = (e) => {
        // In RTL (`dir="rtl"`), moving mouse left (`e.clientX < startX`) widens right-side panel!
        const delta = startX - e.clientX;
        const newWidth = Math.max(minW, Math.min(maxW, startWidth + delta));
        panelEl.style.width = `${newWidth}px`;
      };

      const onMouseUp = () => {
        handleEl.classList.remove('dragging');
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      handleEl.addEventListener('mousedown', (e) => {
        e.preventDefault();
        startX = e.clientX;
        startWidth = panelEl.getBoundingClientRect().width;
        handleEl.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    }

    makeResizable(
      document.getElementById('splitterCat'),
      document.getElementById('categoriesPanel'),
      175,
      360
    );
    makeResizable(
      document.getElementById('splitterCh'),
      document.getElementById('channelsPanel'),
      255,
      580
    );
  }

  function toggleTheaterMode() {
    const active = document.body.classList.toggle('theater-mode');
    document.getElementById('btnTheaterMode').classList.toggle('active', active);
  }

  function bindAllEvents() {
    // Electron Desktop Window Controls
    if (window.api.isElectron) {
      document.querySelectorAll('.electron-only').forEach((el) => el.classList.remove('hidden'));
      document.getElementById('btnWinMin').onclick = () => window.api.windowControl('minimize');
      document.getElementById('btnWinMax').onclick = () => window.api.windowControl('maximize');
      document.getElementById('btnWinClose').onclick = () => window.api.windowControl('close');
      document.getElementById('btnPinWindow').onclick = async (e) => {
        const res = await window.api.windowControl('toggle-pin');
        e.currentTarget.classList.toggle('active', Boolean(res.isAlwaysOnTop));
        showToast(res.isAlwaysOnTop ? '📌 تم تثبيت النافذة في المقدمة' : 'تم إلغاء تثبيت النافذة');
      };
    }

    // Sidebar Page Navigation
    document.querySelectorAll('.nav-buttons .nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-buttons .nav-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentPage = btn.dataset.page || 'live';
        loadCategoriesAndChannels();
      });
    });

    // Header Playlist Switcher
    document.getElementById('headerPlaylistSelect').addEventListener('change', async (e) => {
      const plId = Number(e.target.value);
      if (plId > 0) {
        await window.api.setActivePlaylist(plId);
        await reloadAllData();
      }
    });

    // Channel Search (instant debounced)
    let searchTimer = null;
    const chSearchInput = document.getElementById('chSearchInput');
    const btnClearSearch = document.getElementById('btnClearSearch');

    chSearchInput.addEventListener('input', () => {
      state.searchQuery = chSearchInput.value;
      btnClearSearch.classList.toggle('hidden', !state.searchQuery);
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        loadChannelsForCurrentState(true);
      }, 90);
    });

    btnClearSearch.addEventListener('click', () => {
      chSearchInput.value = '';
      state.searchQuery = '';
      btnClearSearch.classList.add('hidden');
      loadChannelsForCurrentState(true);
    });

    // Favorite Filter Button
    const btnFavFilter = document.getElementById('btnFavFilter');
    btnFavFilter.addEventListener('click', () => {
      state.favOnlyFilter = !state.favOnlyFilter;
      btnFavFilter.classList.toggle('active', state.favOnlyFilter);
      loadChannelsForCurrentState(true);
    });

    // Quality Filter Chips
    document.querySelectorAll('#qualityFilterChips .q-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#qualityFilterChips .q-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        state.qualityFilter = chip.dataset.q || 'all';
        loadChannelsForCurrentState(true);
      });
    });

    // View Mode Toggle (Cards vs Grid)
    const btnCards = document.getElementById('btnViewCards');
    const btnGrid = document.getElementById('btnViewGrid');
    btnCards.onclick = () => {
      btnCards.classList.add('active');
      btnGrid.classList.remove('active');
      catalog.setViewMode('cards');
    };
    btnGrid.onclick = () => {
      btnGrid.classList.add('active');
      btnCards.classList.remove('active');
      catalog.setViewMode('grid');
    };

    // Clear Watch History
    document.getElementById('btnClearHistory').onclick = async () => {
      await window.api.clearHistory();
      await refreshStatsBadges();
      await loadCategoriesAndChannels();
      showToast('🧹 تم مسح سجل المشاهدة');
    };

    // Close Series Drawer
    document.getElementById('btnCloseSeriesDrawer').onclick = () => {
      document.getElementById('seriesEpisodesDrawer').classList.add('hidden');
    };

    // Idle Hero Quick Actions
    document.getElementById('btnIdlePlayFirst').onclick = () => {
      if (state.currentChannels.length > 0) {
        handleChannelActivated(state.currentChannels[0], 0);
      } else {
        openModal('playlistsModal');
      }
    };
    document.getElementById('btnIdleImport').onclick = () => {
      openModal('playlistsModal');
      switchPlaylistTab('fg');
    };

    // Theater Mode & Modals Open/Close
    document.getElementById('btnTheaterMode').onclick = toggleTheaterMode;
    document.getElementById('btnShortcutsHelp').onclick = () => openModal('shortcutsModal');
    document.getElementById('btnPlaylists').onclick = () => openModal('playlistsModal');
    document.getElementById('btnQuickImport').onclick = () => {
      openModal('playlistsModal');
      switchPlaylistTab('fg');
    };
    document.getElementById('btnSettings').onclick = () => {
      refreshStatsBadges();
      openModal('settingsModal');
    };
    document.getElementById('btnAbout').onclick = () => openModal('aboutModal');

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });
    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.classList.add('hidden');
      });
    });

    // Playlist Modal Tabs
    document.querySelectorAll('.modal-tabs .m-tab').forEach((tab) => {
      tab.addEventListener('click', () => switchPlaylistTab(tab.dataset.ptab));
    });

    // Subscribe to backend Import Progress
    window.api.onProgress((prog) => {
      if (prog && typeof prog.percent === 'number') {
        setImportProgress(true, prog.percent, prog.message || '');
      }
    });

    // 1. Import FG Code
    document.getElementById('btnSubmitFgCode').onclick = async () => {
      const code = document.getElementById('fgCodeInput').value.trim();
      if (!code) return showToast('يرجى إدخال كود التفعيل أولاً', 'warn');
      try {
        setImportProgress(true, 5, 'جاري بدء فك تشفير الباقة...');
        const res = await window.api.importFgCode(code);
        await reloadAllData();
        setTimeout(() => setImportProgress(false), 900);
        switchPlaylistTab('saved');
        showToast(`✅ تم استيراد ${res.importedCount} قناة بنجاح عبر محرك FG`);
      } catch (err) {
        setImportProgress(false);
        showToast(err.message, 'error');
      }
    };

    // 2. Import M3U URL
    document.getElementById('btnSubmitM3uUrl').onclick = async () => {
      const url = document.getElementById('m3uUrlInput').value.trim();
      const name = document.getElementById('m3uNameInput').value.trim();
      const userAgent = document.getElementById('m3uUaInput').value.trim();
      if (!url) return showToast('يرجى إدخال رابط M3U أولاً', 'warn');
      try {
        setImportProgress(true, 10, 'جاري الاتصال بالرابط...');
        const res = await window.api.importM3uUrl({ name, url, userAgent });
        await reloadAllData();
        setTimeout(() => setImportProgress(false), 900);
        switchPlaylistTab('saved');
        showToast(`✅ تم استيراد ${res.importedCount.toLocaleString('en-US')} عنصر بنجاح`);
      } catch (err) {
        setImportProgress(false);
        showToast(err.message, 'error');
      }
    };

    // 3. Pick Local M3U File
    document.getElementById('btnPickLocalM3u').onclick = async () => {
      try {
        setImportProgress(true, 20, 'جاري فتح ملف M3U المحلي...');
        const res = await window.api.pickAndImportM3uFile();
        if (res && res.canceled) {
          setImportProgress(false);
          return;
        }
        await reloadAllData();
        setTimeout(() => setImportProgress(false), 900);
        switchPlaylistTab('saved');
        showToast(`✅ تم استيراد ${res.importedCount.toLocaleString('en-US')} قناة من الملف`);
      } catch (err) {
        setImportProgress(false);
        showToast(err.message, 'error');
      }
    };

    // 4. Import Pasted M3U Text
    document.getElementById('btnSubmitM3uText').onclick = async () => {
      const content = document.getElementById('m3uRawTextInput').value.trim();
      const name = document.getElementById('m3uNameInput').value.trim() || 'قائمة M3U مخصصة';
      if (!content) return showToast('الصق محتوى M3U أولاً', 'warn');
      try {
        setImportProgress(true, 30, 'جاري تحليل نص القائمة...');
        const res = await window.api.importM3uText({ name, content });
        await reloadAllData();
        setTimeout(() => setImportProgress(false), 800);
        switchPlaylistTab('saved');
        showToast(`✅ تم استيراد ${res.importedCount} عنصر بنجاح`);
      } catch (err) {
        setImportProgress(false);
        showToast(err.message, 'error');
      }
    };

    // 5. Import Xtream Codes
    document.getElementById('btnSubmitXtream').onclick = async () => {
      const name = document.getElementById('xtNameInput').value.trim();
      const host = document.getElementById('xtHostInput').value.trim();
      const username = document.getElementById('xtUserInput').value.trim();
      const password = document.getElementById('xtPassInput').value.trim();
      if (!host || !username || !password) {
        return showToast('يرجى تعبئة بيانات السيرفر واسم المستخدم وكلمة المرور', 'warn');
      }
      try {
        setImportProgress(true, 10, 'جاري الاتصال بخادم Xtream...');
        const res = await window.api.importXtream({ name, host, username, password });
        await reloadAllData();
        setTimeout(() => setImportProgress(false), 900);
        switchPlaylistTab('saved');
        showToast(`✅ تم استيراد ${res.importedCount.toLocaleString('en-US')} عنصر من Xtream`);
      } catch (err) {
        setImportProgress(false);
        showToast(err.message, 'error');
      }
    };

    // 6. Restore Demo Bouquet & Run 50,000-Channel Benchmark
    document.getElementById('btnRestoreDemo').onclick = async () => {
      await window.api.seedDemoBouquet();
      await reloadAllData();
      showToast('✨ تمت استعادة باقة ARN التفاعلية الرسمية');
    };

    document.getElementById('btnRunBenchmark50k').onclick = async () => {
      try {
        setImportProgress(true, 15, 'جاري توليد وفهرسة 50,000 قناة في SQLite...');
        const res = await window.api.run50kBenchmark(50000);
        await reloadAllData();
        setTimeout(() => setImportProgress(false), 1600);
        const m = res.metrics || {};
        showToast(
          `🚀 تم إدراج 50,000 قناة في ${m.sqliteInsertMs}ms وزمن البحث المفهرس ${m.indexedSearchMs}ms!`
        );
      } catch (err) {
        setImportProgress(false);
        showToast(err.message, 'error');
      }
    };

    // Settings Controls
    document.getElementById('chkAutoFailover').addEventListener('change', async (e) => {
      const val = e.target.checked;
      player.autoFailover = val;
      await window.api.setSetting('autoFailover', String(val));
      showToast(val ? '✅ تم تفعيل التحويل التلقائي بين السيرفرات' : 'تم إيقاف التحويل التلقائي');
    });

    document.getElementById('chkRememberPos').addEventListener('change', async (e) => {
      const val = e.target.checked;
      player.rememberPosition = val;
      await window.api.setSetting('rememberPosition', String(val));
    });

    document.getElementById('selBufferProfile').addEventListener('change', async (e) => {
      const val = e.target.value;
      player.bufferProfile = val;
      await window.api.setSetting('bufferProfile', val);
      showToast('⚙️ تم تحديث ملف التخزين المؤقت للبث');
    });

    // External Social Links (ARN Standards)
    document.querySelectorAll('[data-social-url]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.api.openSocialLink(btn.dataset.socialUrl);
      });
    });

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        if (e.key === 'Escape') e.target.blur();
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          player.togglePlayPause();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          player.toggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          player.toggleMute();
          break;
        case 't':
        case 'T':
          e.preventDefault();
          toggleTheaterMode();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          player.reloadCurrentStream();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          player.takeSnapshot();
          break;
        case 'ArrowUp':
          e.preventDefault();
          player.setVolume(player.currentVolume + 5, { showOsd: true });
          break;
        case 'ArrowDown':
          e.preventDefault();
          player.setVolume(player.currentVolume - 5, { showOsd: true });
          break;
        case 'ArrowRight':
          e.preventDefault();
          // Note: in RTL users often expect right/left seek; support smooth ±10s
          player.seekBy(-10);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          player.seekBy(10);
          break;
        case '?':
        case '؟':
          openModal('shortcutsModal');
          break;
        case 'Escape':
          document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach((m) => m.classList.add('hidden'));
          if (document.body.classList.contains('theater-mode')) {
            toggleTheaterMode();
          }
          break;
        default:
          break;
      }
    });
  }

  function switchPlaylistTab(tabKey) {
    document.querySelectorAll('.modal-tabs .m-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.ptab === tabKey);
    });
    document.querySelectorAll('.ptab-pane').forEach((pane) => {
      pane.classList.toggle('active', pane.id === `ptab-${tabKey}`);
    });
  }

  async function bootstrap() {
    setupColumnSplitters();
    bindAllEvents();

    try {
      const settings = await window.api.getSettings();
      player.applySettings(settings);

      document.getElementById('chkAutoFailover').checked = String(settings.autoFailover) !== 'false';
      document.getElementById('chkRememberPos').checked = String(settings.rememberPosition) !== 'false';
      if (settings.bufferProfile) {
        document.getElementById('selBufferProfile').value = settings.bufferProfile;
      }

      await reloadAllData();
    } catch (err) {
      showToast(`خطأ في تهيئة التطبيق: ${err.message}`, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})();
