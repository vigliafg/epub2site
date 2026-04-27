(function () {
  'use strict';

  const THEME_KEY = 'epub-theme';
  const FONT_KEY = 'epub-font-size';
  const ENRICHED_KEY = 'epub-css-enriched';
  const POS_PREFIX = 'epub-pos:';
  const FONT_MIN = 0.8;
  const FONT_MAX = 1.8;
  const FONT_STEP = 0.1;

  // ---- State from page ----
  const chapterIndex = parseInt(document.body.getAttribute('data-chapter-index'), 10);
  const totalChapters = parseInt(document.body.getAttribute('data-chapter-total'), 10) || 1;
  const pathPrefix = window.TOC_PATH_PREFIX || '';
  const toc = window.TOC || {};
  const tocItems = toc.tree || toc.chapters || [];

  // ---- Theme ----
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  (function initTheme() {
    applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  }());

  document.getElementById('toggle-theme').addEventListener('click', () => {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  // ---- Font size ----
  function applyFontSize(size) {
    const clamped = Math.min(FONT_MAX, Math.max(FONT_MIN, size));
    document.documentElement.style.setProperty('--font-size', clamped + 'rem');
    localStorage.setItem(FONT_KEY, String(clamped));
    return clamped;
  }

  (function initFontSize() {
    const saved = parseFloat(localStorage.getItem(FONT_KEY));
    applyFontSize(isNaN(saved) ? 1.1 : saved);
  }());

  document.getElementById('font-up').addEventListener('click', () => {
    const cur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-size')) || 1.1;
    applyFontSize(cur + FONT_STEP);
  });

  document.getElementById('font-down').addEventListener('click', () => {
    const cur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-size')) || 1.1;
    applyFontSize(cur - FONT_STEP);
  });

  // ---- TOC sidebar: hierarchical tree ----
  function buildSidebar() {
    const sidebar = document.getElementById('toc-sidebar');
    if (!sidebar) return;

    // Title
    const titleEl = document.createElement('div');
    titleEl.className = 'sidebar-title';
    titleEl.textContent = toc.title || 'Indice';
    sidebar.appendChild(titleEl);

    if (!tocItems.length) return;

    // Pre-compute which items have children
    const hasChildren = tocItems.map((item, i) => {
      const itemLevel = item.level || 0;
      for (let j = i + 1; j < tocItems.length; j++) {
        const nextLevel = tocItems[j].level || 0;
        if (nextLevel <= itemLevel) break;
        if (nextLevel > itemLevel) return true;
      }
      return false;
    });

    // Build nested UL using a stack
    const root = document.createElement('ul');
    root.className = 'toc-list';

    // stack entries: { ul, level }
    const stack = [{ ul: root, level: -1 }];

    tocItems.forEach((item, i) => {
      const itemLevel = item.level || 0;

      // Pop until parent level < current item level
      while (stack.length > 1 && stack[stack.length - 1].level >= itemLevel) {
        stack.pop();
      }
      const parentUl = stack[stack.length - 1].ul;

      const li = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'toc-row';

      // Toggle button (only for items with children)
      let childUl = null;
      if (hasChildren[i]) {
        const toggle = document.createElement('button');
        toggle.className = 'toc-toggle';
        toggle.innerHTML = '&#9654;'; // ▶
        toggle.setAttribute('aria-expanded', 'false');
        row.appendChild(toggle);

        childUl = document.createElement('ul');
        childUl.className = 'toc-children hidden';

        toggle.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          const isHidden = childUl.classList.contains('hidden');
          childUl.classList.toggle('hidden', !isHidden);
          toggle.innerHTML = isHidden ? '&#9660;' : '&#9654;'; // ▼ / ▶
          toggle.setAttribute('aria-expanded', String(isHidden));
        });
      }

      // Link
      const a = document.createElement('a');
      const href = item.href || '#';
      a.href = href.startsWith('http') ? href : pathPrefix + href;
      a.textContent = item.title || '';
      a.title = item.title || '';
      row.appendChild(a);
      li.appendChild(row);

      // Mark current chapter
      const itemChapterIdx = item.chapterIndex !== undefined ? item.chapterIndex : item.index;
      if (itemChapterIdx === chapterIndex) {
        li.classList.add('current');
      }

      parentUl.appendChild(li);

      if (childUl) {
        li.appendChild(childUl);
        stack.push({ ul: childUl, level: itemLevel });
      }
    });

    sidebar.appendChild(root);

    // Auto-expand ancestors of current chapter and scroll into view
    const currentLi = root.querySelector('li.current');
    if (currentLi) {
      let node = currentLi.parentElement;
      while (node && node !== sidebar) {
        if (node.classList.contains('toc-children')) {
          node.classList.remove('hidden');
          const parentLi = node.parentElement;
          if (parentLi) {
            const toggle = parentLi.querySelector(':scope > .toc-row > .toc-toggle');
            if (toggle) {
              toggle.innerHTML = '&#9660;';
              toggle.setAttribute('aria-expanded', 'true');
            }
          }
        }
        node = node.parentElement;
      }
      setTimeout(() => currentLi.scrollIntoView({ block: 'nearest' }), 50);
    }
  }

  // ---- Sidebar toggle ----
  const sidebar = document.getElementById('toc-sidebar');
  const SIDEBAR_WIDTH_KEY = 'epub-sidebar-width';

  (function initSidebar() {
    // Restore saved width
    const savedWidth = parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY), 10);
    if (savedWidth && savedWidth >= 180 && savedWidth <= 450) {
      sidebar.style.width = savedWidth + 'px';
    }
    
    if (window.innerWidth <= 768) sidebar.classList.add('hidden');
  }());

  document.getElementById('toggle-toc').addEventListener('click', () => {
    sidebar.classList.toggle('hidden');
  });

  // ---- Sidebar resize ----
  (function initResize() {
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'sidebar-resize';
    resizeHandle.setAttribute('title', 'Trascina per ridimensionare');
    sidebar.appendChild(resizeHandle);

    let isDragging = false;
    let startX, startWidth;

    resizeHandle.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startWidth = sidebar.offsetWidth;
      resizeHandle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const newWidth = Math.min(450, Math.max(180, startWidth + dx));
      sidebar.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        resizeHandle.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        // Save width to localStorage
        localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebar.offsetWidth);
      }
    });
  }());

  sidebar.addEventListener('click', (e) => {
    if (e.target.tagName === 'A' && window.innerWidth <= 768) {
      sidebar.classList.add('hidden');
    }
  });

  // ---- Progress bar ---- */
  (function updateProgress() {
    const fill = document.querySelector('.progress-fill');
    if (!fill || chapterIndex < 0) return;
    fill.style.width = (totalChapters > 1 ? (chapterIndex + 1) / totalChapters * 100 : 100) + '%';
  }());

  // ---- Scroll position persistence ----
  if (chapterIndex >= 0) {
    const posKey = POS_PREFIX + chapterIndex;

    window.addEventListener('scroll', () => {
      localStorage.setItem(posKey, String(window.scrollY));
    }, { passive: true });

    window.addEventListener('load', () => {
      const navType = performance.getEntriesByType('navigation')[0]?.type;
      if (navType === 'navigate') return;
      const saved = parseInt(localStorage.getItem(posKey), 10);
      if (!isNaN(saved) && saved > 0) setTimeout(() => window.scrollTo(0, saved), 80);
    });
  }

  // ---- Enriched CSS toggle ----
  (function initEnriched() {
    const href = document.body.dataset.enrichedCssHref;
    const btn = document.getElementById('toggle-enriched');
    if (!href || !btn) return;

    btn.style.display = '';

    function applyEnriched(enabled) {
      let link = document.getElementById('epub-enriched-css');
      if (enabled && !link) {
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.id = 'epub-enriched-css';
        link.href = href;
        document.head.appendChild(link);
      } else if (!enabled && link) {
        link.remove();
      }
      btn.classList.toggle('active', enabled);
      localStorage.setItem(ENRICHED_KEY, String(enabled));
    }

    applyEnriched(localStorage.getItem(ENRICHED_KEY) === 'true');

    btn.addEventListener('click', () => {
      applyEnriched(!document.getElementById('epub-enriched-css'));
    });
  }());

  // ---- Init ----
  buildSidebar();
}());
