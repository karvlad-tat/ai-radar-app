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
    const views = Number(video.statistics && video.statistics.viewCount) || 0;
    const published = video.snippet.publishedAt;
    const age = ageDays(published, now);
    return {
      id: 'yt:' + video.id,
      source: 'youtube',
      title: video.snippet.title,
      description: video.snippet.channelTitle || '',
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
    if (n >= 1e4) return Math.round(n / 1e3) + 'K';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
    return String(Math.round(n));
  }

  /* Добавляет growthScore (0..1) — темп роста относительно лучшего в своём источнике.
     Нужен для общей сортировки в «Обзоре»: звёзды, просмотры и очки несравнимы напрямую. */
  function withScores(items) {
    const maxBySource = {};
    for (const it of items) maxBySource[it.source] = Math.max(maxBySource[it.source] || 0, it.growth);
    const maxPop = {};
    for (const it of items) maxPop[it.source] = Math.max(maxPop[it.source] || 0, it.popularity);
    return items.map((it) => ({
      ...it,
      growthScore: maxBySource[it.source] ? it.growth / maxBySource[it.source] : 0,
      popularityScore: maxPop[it.source] ? it.popularity / maxPop[it.source] : 0,
    }));
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

  /* Сортировка. В одном источнике сравниваем сырые значения, в «Обзоре» (mixed) — нормализованные. */
  function sortItems(items, mode, mixed) {
    const arr = items.slice();
    const key = {
      growth: mixed ? 'growthScore' : 'growth',
      popularity: mixed ? 'popularityScore' : 'popularity',
    }[mode];
    if (mode === 'date') arr.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    else if (key) arr.sort((a, b) => b[key] - a[key] || b.popularity - a.popularity);
    return arr;
  }

  function relativeDate(iso, now) {
    const d = (now - Date.parse(iso)) / DAY;
    if (Number.isNaN(d)) return '';
    if (d < 1 / 24) return 'только что';
    if (d < 1) return Math.floor(d * 24) + ' ч назад';
    return Math.floor(d) + ' дн. назад';
  }

  /* Запрашивает 3 темы и объединяет без дубликатов. */
  function dedupe(items) {
    const seen = new Set();
    return items.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));
  }

  function isoDaysAgo(days, now) {
    return new Date(now - days * DAY).toISOString();
  }

  return { ageDays, fromGithub, fromHN, fromYouTube, formatNumber, withScores, filterItems, sortItems, relativeDate, dedupe, isoDaysAgo, hostname };
});
