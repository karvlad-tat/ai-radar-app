/* Чистая логика AI Radar: без DOM и сети, чтобы её можно было тестировать в Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RadarLib = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DAY = 86400000;

  function ageDays(iso, now) {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return 1;
    return Math.max((now - t) / DAY, 1); // меньше суток считаем сутками, чтобы свежие записи не получали завышенный темп
  }

  /* Нормализация источников к общему виду карточки. */
  function fromGithub(repo, now) {
    const age = ageDays(repo.created_at, now);
    return {
      id: 'gh:' + repo.full_name,
      source: 'github',
      title: repo.full_name,
      description: repo.description || '',
      url: repo.html_url,
      date: repo.created_at,
      popularity: repo.stargazers_count,
      growth: repo.stargazers_count / age,
      metricLabel: formatNumber(repo.stargazers_count) + ' ★',
      growthLabel: '+' + formatNumber(Math.round(repo.stargazers_count / age)) + ' ★/день',
      growthValue: '+' + formatNumber(Math.round(repo.stargazers_count / age)),
      growthUnit: '★/день',
    };
  }

  function fromHN(hit, now) {
    const points = hit.points || 0;
    const age = ageDays(hit.created_at, now);
    return {
      id: 'hn:' + hit.objectID,
      source: 'hackernews',
      title: hit.title || '(без заголовка)',
      description: hit.url ? hostname(hit.url) : '',
      url: 'https://news.ycombinator.com/item?id=' + hit.objectID,
      date: hit.created_at,
      popularity: points,
      growth: points / age,
      metricLabel: formatNumber(points) + ' очков · ' + formatNumber(hit.num_comments || 0) + ' ком.',
      growthLabel: '+' + formatNumber(Math.round(points / age)) + ' очков/день',
      growthValue: '+' + formatNumber(Math.round(points / age)),
      growthUnit: 'очков/день',
    };
  }

  function fromYouTube(video, now) {
    const snippet = video.snippet || {};
    const views = Number(video.statistics && video.statistics.viewCount) || 0;
    const published = snippet.publishedAt;
    const age = ageDays(published, now);
    return {
      id: 'yt:' + video.id,
      source: 'youtube',
      title: snippet.title || '(без названия)',
      description: snippet.channelTitle || '',
      url: 'https://www.youtube.com/watch?v=' + video.id,
      date: published,
      popularity: views,
      growth: views / age,
      metricLabel: formatNumber(views) + ' просм.',
      growthLabel: '+' + formatNumber(Math.round(views / age)) + ' просм./день',
      growthValue: formatNumber(Math.round(views / age)),
      growthUnit: 'просм./день',
    };
  }

  function hostname(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  function formatNumber(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.0', '') + 'M';
    if (n >= 1e4) { const k = Math.round(n / 1e3); return k >= 1000 ? '1M' : k + 'K'; }
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
    return String(Math.round(n));
  }

  /* Поиск по всем источникам: все слова запроса должны встретиться в заголовке, описании или источнике. */
  function filterItems(items, query) {
    const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return items;
    return items.filter((it) => {
      const hay = (it.title + ' ' + it.description + ' ' + it.source).toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }

  const time = (iso) => { const t = Date.parse(iso); return Number.isNaN(t) ? 0 : t; };

  /* Сортировка по скорости роста, дате или популярности. Исходный массив не меняется. */
  function sortItems(items, mode) {
    const arr = items.slice();
    if (mode === 'date') arr.sort((a, b) => time(b.date) - time(a.date));
    else if (mode === 'growth') arr.sort((a, b) => b.growth - a.growth || b.popularity - a.popularity);
    else if (mode === 'popularity') arr.sort((a, b) => b.popularity - a.popularity || b.growth - a.growth);
    return arr;
  }

  function relativeDate(iso, now) {
    const d = (now - Date.parse(iso)) / DAY;
    if (Number.isNaN(d)) return '';
    if (d < 1 / 24) return 'только что';
    if (d < 1) return Math.floor(d * 24) + ' ч назад';
    return Math.floor(d) + ' дн. назад';
  }

  /* Убирает дубликаты по id (одна запись может прийти из нескольких запросов). */
  function dedupe(items) {
    const seen = new Set();
    return items.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));
  }

  function isoDaysAgo(days, now) {
    return new Date(now - days * DAY).toISOString();
  }

  return { ageDays, fromGithub, fromHN, fromYouTube, formatNumber, filterItems, sortItems, relativeDate, dedupe, isoDaysAgo, hostname };
});
