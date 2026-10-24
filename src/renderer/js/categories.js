'use strict';

/**
 * ARN IPTV Pro — Categories Column & 60fps Virtual Channels Renderer
 * Copyright © 2026 عبده رجب نصار — شركة ARN Technology
 *
 * Renders up to 50,000+ channels with zero DOM lag using windowed virtual scrolling.
 */

class ArnCatalogView {
  constructor({ onSelectCategory, onSelectChannel, onToggleFavorite }) {
    this.onSelectCategory = onSelectCategory;
    this.onSelectChannel = onSelectChannel;
    this.onToggleFavorite = onToggleFavorite;

    this.categories = [];
    this.totalCategoryChannels = 0;
    this.activeCategoryId = 'all';
    this.catSearchQuery = '';

    this.channels = [];
    this.activeChannelId = null;
    this.viewMode = 'cards'; // 'cards' | 'grid'

    // DOM Elements
    this.catCountBadge = document.getElementById('catCountBadge');
    this.catSearchInput = document.getElementById('catSearchInput');
    this.categoriesListEl = document.getElementById('categoriesList');

    this.chCountBadge = document.getElementById('chCountBadge');
    this.viewportEl = document.getElementById('channelsList');
    this.spacerEl = document.getElementById('channelsSpacer');
    this.contentEl = document.getElementById('channelsVirtualContent');

    this._rafPending = false;
    this._bindEvents();
  }

  _bindEvents() {
    this.catSearchInput.addEventListener('input', () => {
      this.catSearchQuery = this.catSearchInput.value.trim().toLowerCase();
      this.renderCategories();
    });

    this.viewportEl.addEventListener(
      'scroll',
      () => {
        if (!this._rafPending) {
          this._rafPending = true;
          requestAnimationFrame(() => {
            this._rafPending = false;
            this._renderVirtualSlice();
          });
        }
      },
      { passive: true }
    );

    window.addEventListener('resize', () => {
      this._renderVirtualSlice();
    });

    // Clean CSP-safe image fallback handler (replaces broken external logos with monogram)
    this.contentEl.addEventListener(
      'error',
      (e) => {
        const img = e.target;
        if (img && img.tagName === 'IMG' && img.parentElement?.classList.contains('ch-avatar')) {
          const fallback = img.dataset.fallback || 'ARN';
          const parent = img.parentElement;
          img.remove();
          parent.textContent = fallback;
        }
      },
      true
    );

    // Event delegation for channels virtual container
    this.contentEl.addEventListener('click', (e) => {
      const favBtn = e.target.closest('.btn-card-fav');
      if (favBtn) {
        e.stopPropagation();
        const chId = Number(favBtn.dataset.favId);
        if (chId && this.onToggleFavorite) {
          this.onToggleFavorite(chId);
        }
        return;
      }

      const card = e.target.closest('.channel-card');
      if (card) {
        const chIdx = Number(card.dataset.idx);
        const ch = this.channels[chIdx];
        if (ch && this.onSelectChannel) {
          this.onSelectChannel(ch, chIdx);
        }
      }
    });
  }

  setViewMode(mode) {
    this.viewMode = mode === 'grid' ? 'grid' : 'cards';
    this.contentEl.classList.toggle('grid-mode', this.viewMode === 'grid');
    this.viewportEl.scrollTop = 0;
    this._renderVirtualSlice();
  }

  setCategoriesData({ categories = [], totalChannels = 0 }, selectedCategoryId = 'all') {
    this.categories = categories;
    this.totalCategoryChannels = totalChannels;
    this.activeCategoryId = selectedCategoryId;
    this.catCountBadge.textContent = `${categories.length} فئة`;
    this.renderCategories();
  }

  renderCategories() {
    const q = this.catSearchQuery;
    const frag = document.createDocumentFragment();

    // "🌐 الكل" item
    if (!q || 'الكل'.includes(q) || 'all'.includes(q)) {
      const allEl = document.createElement('div');
      allEl.className = `cat-item ${this.activeCategoryId === 'all' ? 'active' : ''}`;
      allEl.innerHTML = `
        <span class="cat-name">🌐 الكل</span>
        <span class="cat-count">${this.totalCategoryChannels.toLocaleString('en-US')}</span>
      `;
      allEl.onclick = () => {
        this.activeCategoryId = 'all';
        this.renderCategories();
        if (this.onSelectCategory) this.onSelectCategory('all', '🌐 الكل');
      };
      frag.appendChild(allEl);
    }

    for (let i = 0; i < this.categories.length; i++) {
      const cat = this.categories[i];
      if (q && !cat.name.toLowerCase().includes(q)) continue;

      const el = document.createElement('div');
      const isAct = String(this.activeCategoryId) === String(cat.id);
      el.className = `cat-item ${isAct ? 'active' : ''}`;
      el.innerHTML = `
        <span class="cat-name"></span>
        <span class="cat-count">${Number(cat.count || 0).toLocaleString('en-US')}</span>
      `;
      el.querySelector('.cat-name').textContent = cat.name;
      el.onclick = () => {
        this.activeCategoryId = cat.id;
        this.renderCategories();
        if (this.onSelectCategory) this.onSelectCategory(cat.id, cat.name);
      };
      frag.appendChild(el);
    }

    this.categoriesListEl.innerHTML = '';
    this.categoriesListEl.appendChild(frag);
  }

  setChannels(items = [], pageType = 'live', resetScroll = true) {
    this.channels = items;
    const unitLabel =
      pageType === 'movies'
        ? 'فيلم'
        : pageType === 'series'
          ? 'مسلسل'
          : pageType === 'fav' || pageType === 'history'
            ? 'عنصر'
            : 'قناة';
    this.chCountBadge.textContent = `${items.length.toLocaleString('en-US')} ${unitLabel}`;

    if (resetScroll) {
      this.viewportEl.scrollTop = 0;
    }
    this._renderVirtualSlice();
  }

  setActiveChannel(channelId) {
    this.activeChannelId = channelId ? Number(channelId) : null;
    this._renderVirtualSlice();
  }

  updateChannelFavoriteState(channelId, isFavorite) {
    const target = this.channels.find((c) => c.id === Number(channelId));
    if (target) {
      target.isFavorite = Boolean(isFavorite);
      this._renderVirtualSlice();
    }
  }

  _buildMonogram(name) {
    const clean = String(name || 'ARN')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    }
    return (clean.slice(0, 3) || 'ARN').toUpperCase();
  }

  _escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _renderVirtualSlice() {
    const total = this.channels.length;

    if (total === 0) {
      this.spacerEl.style.height = '220px';
      this.contentEl.style.transform = 'translateY(0px)';
      this.contentEl.innerHTML = `
        <div class="empty-state-box" style="grid-column: 1 / -1;">
          <span class="empty-icon">📡</span>
          <p>لا توجد عناصر مطابقة للفلتر الحالي</p>
        </div>
      `;
      return;
    }

    const isGrid = this.viewMode === 'grid';
    const rowHeight = isGrid ? 99 : 68; // card height + gap
    const cols = isGrid ? 2 : 1;
    const totalRows = Math.ceil(total / cols);
    const totalHeight = totalRows * rowHeight;

    this.spacerEl.style.height = `${totalHeight}px`;

    const scrollTop = this.viewportEl.scrollTop;
    const viewportHeight = this.viewportEl.clientHeight || 600;
    const overscanRows = 6;

    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscanRows);
    const endRow = Math.min(
      totalRows,
      Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscanRows
    );

    const startIndex = startRow * cols;
    const endIndex = Math.min(total, endRow * cols);
    const offsetY = startRow * rowHeight;

    this.contentEl.style.transform = `translateY(${offsetY}px)`;

    const htmlParts = [];
    for (let i = startIndex; i < endIndex; i++) {
      const ch = this.channels[i];
      const isPlaying = this.activeChannelId === ch.id;
      const q = this._escapeHtml(ch.quality || 'HD');
      const qClass = ['4K', 'FHD', 'HD', 'SD'].includes(q) ? `q-${q}` : 'q-HD';
      const srvCount = Array.isArray(ch.sources) ? ch.sources.length : 1;
      const monogram = this._escapeHtml(this._buildMonogram(ch.name));
      const safeName = this._escapeHtml(ch.name);
      const safeGroup = this._escapeHtml(ch.groupTitle || 'عام');

      const avatarInner = ch.logo
        ? `<img src="${this._escapeHtml(ch.logo)}" data-fallback="${monogram}" alt="" loading="lazy">`
        : monogram;

      const playingEq = isPlaying
        ? `<span class="eq-bars" title="يعمل الآن"><i></i><i></i><i></i></span>`
        : '';

      const extraSub =
        ch.contentType === 'movie' && ch.meta?.rating
          ? `<span class="srv-count-pill">⭐ ${this._escapeHtml(ch.meta.rating)}</span>`
          : ch.contentType === 'series' && Array.isArray(ch.meta?.episodes)
            ? `<span class="srv-count-pill">${ch.meta.episodes.length} حلقة</span>`
            : srvCount > 1
              ? `<span class="srv-count-pill">${srvCount} سيرفر</span>`
              : '';

      if (isGrid) {
        htmlParts.push(`
          <div class="channel-card ${isPlaying ? 'playing' : ''}" data-idx="${i}">
            <div class="ch-top-grid">
              <div class="ch-avatar" style="width:34px;height:34px;font-size:11px;">${avatarInner}</div>
              <div class="ch-actions">
                ${playingEq}
                <span class="q-badge ${qClass}">${q}</span>
                <button class="btn-card-fav ${ch.isFavorite ? 'is-fav' : ''}" data-fav-id="${ch.id}" title="المفضلة">★</button>
              </div>
            </div>
            <div class="ch-info" style="width:100%;">
              <div class="ch-title" title="${safeName}">${safeName}</div>
            </div>
          </div>
        `);
      } else {
        htmlParts.push(`
          <div class="channel-card ${isPlaying ? 'playing' : ''}" data-idx="${i}">
            <div class="ch-avatar">${avatarInner}</div>
            <div class="ch-info">
              <div class="ch-title-row">
                ${playingEq}
                <span class="ch-title" title="${safeName}">${safeName}</span>
              </div>
              <div class="ch-sub-row">
                <span class="q-badge ${qClass}">${q}</span>
                ${extraSub}
                <span class="ch-group-lbl">${safeGroup}</span>
              </div>
            </div>
            <div class="ch-actions">
              <button class="btn-card-fav ${ch.isFavorite ? 'is-fav' : ''}" data-fav-id="${ch.id}" title="إضافة / إزالة من المفضلة">★</button>
            </div>
          </div>
        `);
      }
    }

    this.contentEl.innerHTML = htmlParts.join('');
  }
}

window.ArnCatalogView = ArnCatalogView;
