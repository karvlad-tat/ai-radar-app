(function () {
  const L = window.RadarLib;
  const S = window.RadarSources;
  const SOURCES = ['github', 'youtube', 'hackernews'];
  const SOURCE_NAMES = { github: 'GitHub', youtube: 'YouTube', hackernews: 'HackerNews' };
  const OVERVIEW_LIMIT = 12;

  const state = {
    tab: 'overview',
    query: '',
    sort: 'growth',
    data: { github: [], youtube: [], hackernews: [] },
    status: { github: 'loading', youtube: 'loading', hackernews: 'loading' }, // loading | ok | error | nokey
    errors: {},
    loadedAt: null,
  };

  const $ = (id) => document.getElementById(id);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* хранилище недоступно */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* хранилище недоступно */ } },
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- тема ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const dark = theme === 'dark';
    $('theme').setAttribute('aria-checked', String(dark));
    $('theme-text').textContent = dark ? 'Тёмная' : 'Светлая';
  }
  function initTheme() {
    const saved = store.get('radar-theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));
    $('theme').addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      store.set('radar-theme', next);
    });
  }

  /* ---------- ключ YouTube: config.js (необязательный файл) или поле на вкладке ---------- */
  function youtubeKey() {
    return (window.RADAR_CONFIG && window.RADAR_CONFIG.youtubeApiKey) || store.get('radar-yt-key') || '';
  }
  function loadOptionalConfig() {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'config.js';
      s.onload = s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }

  /* ---------- загрузка ---------- */
  async function loadSource(name) {
    state.status[name] = 'loading';
    render();
    const now = Date.now();
    try {
      let items;
      if (name === 'github') items = await S.loadGithub(now);
      else if (name === 'hackernews') items = await S.loadHN(now);
      else items = await S.loadYouTube(now, youtubeKey());
      state.data[name] = items;
      state.status[name] = 'ok';
      delete state.errors[name];
    } catch (e) {
      state.data[name] = [];
      if (e.code === 'NO_KEY') state.status[name] = 'nokey';
      else {
        state.status[name] = 'error';
        state.errors[name] = describeError(name, e);
      }
    }
    state.loadedAt = new Date();
    render();
  }

  function describeError(name, e) {
    if (e.status === 403 || e.status === 429) {
      return name === 'github'
        ? 'GitHub ограничил число запросов без ключа. Подождите минуту и повторите.'
        : 'Превышена квота или доступ запрещён (HTTP ' + e.status + ').';
    }
    if (e.status === 400 || e.status === 401) return 'Ключ не принят (HTTP ' + e.status + '). Проверьте ключ YouTube Data API v3.';
    return 'Не удалось загрузить данные: ' + (e.message || 'ошибка сети') + '.';
  }

  /* ---------- вычисление списка ---------- */
  function itemsFor(source) {
    return L.sortItems(L.filterItems(state.data[source], state.query), state.sort, false);
  }

  function counts() {
    const c = {};
    let total = 0;
    for (const s of SOURCES) {
      c[s] = state.status[s] === 'ok' ? L.filterItems(state.data[s], state.query).length : null;
      total += c[s] || 0;
    }
    c.overview = SOURCES.some((s) => state.status[s] === 'ok') ? total : null;
    return c;
  }

  /* ---------- рендер ---------- */
  function renderNotices() {
    const tabs = state.tab === 'overview' ? SOURCES : [state.tab];
    const out = [];
    for (const s of tabs) {
      if (state.status[s] === 'nokey') {
        out.push('<div class="notice"><div><b>YouTube: нужен ключ API.</b> Вставьте ключ YouTube Data API v3 ниже, он сохранится только в этом браузере. ' +
          'Либо создайте файл <code>config.js</code> (см. <code>config.example.js</code>).</div>' +
          '<form class="key-form" id="key-form"><input id="key-input" type="password" placeholder="Ключ YouTube Data API v3" autocomplete="off" aria-label="Ключ YouTube Data API v3">' +
          '<button class="btn" type="submit">Сохранить и загрузить</button></form></div>');
      } else if (state.status[s] === 'error') {
        out.push('<div class="notice"><div><b>' + SOURCE_NAMES[s] + ':</b> ' + esc(state.errors[s]) + '</div>' +
          '<div><button class="btn ghost" type="button" data-retry="' + s + '">Повторить</button>' +
          (s === 'youtube' ? ' <button class="btn ghost" type="button" id="key-reset">Сменить ключ</button>' : '') + '</div></div>');
      }
    }
    $('notices').innerHTML = out.join('');
    const form = $('key-form');
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = $('key-input').value.trim();
      if (!v) return;
      store.set('radar-yt-key', v);
      loadSource('youtube');
    });
    const reset = $('key-reset');
    if (reset) reset.addEventListener('click', () => { store.del('radar-yt-key'); state.status.youtube = 'nokey'; render(); });
    document.querySelectorAll('[data-retry]').forEach((b) => b.addEventListener('click', () => loadSource(b.dataset.retry)));
  }

  function item(it, withDesc) {
    return '<article class="item src-' + it.source + '">' +
      '<div class="n">' + esc(it.growthValue) + '<small>' + esc(it.growthUnit) + '</small></div>' +
      '<div class="body"><a class="title" href="' + esc(it.url) + '" target="_blank" rel="noopener noreferrer">' + esc(it.title) + '</a>' +
      (withDesc && it.description ? '<div class="desc">' + esc(it.description) + '</div>' : '') +
      '<div class="m" title="' + esc(new Date(it.date).toLocaleString('ru-RU')) + '">' + esc(it.metricLabel) + ' · ' + L.relativeDate(it.date, Date.now()) + '</div></div>' +
      '</article>';
  }

  function placeholder(source, hasItems) {
    const st = state.status[source];
    if (st === 'loading') return '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    if (st === 'nokey') return '<div class="empty">Нужен ключ API, см. подсказку выше.</div>';
    if (st === 'error') return '<div class="empty">Не удалось загрузить.</div>';
    if (!hasItems) return '<div class="empty">' + (state.query ? 'Ничего не найдено по запросу «' + esc(state.query) + '».' : 'За 7 дней ничего не нашлось.') + '</div>';
    return '';
  }

  function render() {
    document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === state.tab)));
    document.querySelectorAll('[data-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sort === state.sort)));
    const c = counts();
    document.querySelectorAll('[data-count]').forEach((el) => { el.textContent = c[el.dataset.count] == null ? '' : c[el.dataset.count]; });
    renderNotices();

    const view = $('view');
    if (state.tab === 'overview') {
      view.innerHTML = '<div class="cols">' + SOURCES.map((s) => {
        const all = itemsFor(s);
        const shown = all.slice(0, OVERVIEW_LIMIT);
        return '<section class="col src-' + s + '"><h2>' + SOURCE_NAMES[s] + '<span>' + (c[s] == null ? '' : c[s]) + '</span></h2>' +
          '<div class="stack">' + (shown.length ? shown.map((it) => item(it, false)).join('') : placeholder(s, false)) +
          (all.length > shown.length ? '<button class="more" type="button" data-open="' + s + '">Показать все ' + all.length + ' →</button>' : '') +
          '</div></section>';
      }).join('') + '</div>';
      view.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.open; render(); window.scrollTo(0, 0); }));
    } else {
      const s = state.tab;
      const all = itemsFor(s);
      view.innerHTML = all.length ? '<div class="grid src-' + s + '">' + all.map((it) => item(it, true)).join('') + '</div>' : placeholder(s, false);
    }

    $('foot').textContent = state.loadedAt ? 'Обновлено ' + state.loadedAt.toLocaleTimeString('ru-RU') +
      '. GitHub: репозитории, созданные за 7 дней, темп = звёзды в день с момента создания.' : '';
  }

  /* ---------- события ---------- */
  function bind() {
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { state.tab = t.dataset.tab; render(); }));
    $('q').addEventListener('input', (e) => { state.query = e.target.value; render(); });
    document.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => { state.sort = b.dataset.sort; render(); }));
  }

  async function init() {
    initTheme();
    bind();
    render();
    await loadOptionalConfig();
    SOURCES.forEach(loadSource);
  }
  init();
})();
