/* Загрузка данных из трёх источников. Каждая функция возвращает массив карточек общего вида (см. lib.js). */
(function () {
  const L = window.RadarLib;
  const WEEK = 7;

  async function getJSON(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const err = new Error('HTTP ' + res.status);
      err.status = res.status;
      try { err.body = await res.json(); } catch (e) { /* тело не JSON */ }
      throw err;
    }
    return res.json();
  }

  /* GitHub: публичный Search API без ключа.
     Прямой «прирост звёзд за неделю» API не отдаёт, поэтому берём репозитории, созданные за 7 дней,
     и считаем темп как звёзды в день с момента создания. */
  async function loadGithub(now) {
    const since = L.isoDaysAgo(WEEK, now).slice(0, 10);
    const topics = ['ai', 'machine-learning', 'llm'];
    const results = await Promise.all(topics.map((t) =>
      getJSON('https://api.github.com/search/repositories?q=' +
        encodeURIComponent('topic:' + t + ' created:>' + since) +
        '&sort=stars&order=desc&per_page=30')));
    const items = results.flatMap((r) => (r.items || []).map((repo) => L.fromGithub(repo, now)));
    return L.dedupe(items);
  }

  /* Hacker News: Algolia HN API без ключа. */
  async function loadHN(now) {
    const ts = Math.floor((now - WEEK * 86400000) / 1000);
    const queries = ['AI', 'LLM', 'OpenAI OR Anthropic OR Gemini'];
    const results = await Promise.all(queries.map((q) =>
      getJSON('https://hn.algolia.com/api/v1/search?query=' + encodeURIComponent(q) +
        '&tags=story&numericFilters=' + encodeURIComponent('created_at_i>' + ts) + '&hitsPerPage=40')));
    const items = results.flatMap((r) => (r.hits || []).filter((h) => h.title).map((h) => L.fromHN(h, now)));
    return L.dedupe(items);
  }

  /* YouTube Data API v3: нужен ключ. Ключ задаёт пользователь (config.js или поле на вкладке). */
  async function loadYouTube(now, apiKey) {
    if (!apiKey) {
      const err = new Error('no-key');
      err.code = 'NO_KEY';
      throw err;
    }
    const after = L.isoDaysAgo(WEEK, now);
    const base = 'https://www.googleapis.com/youtube/v3/';
    const search = await getJSON(base + 'search?part=snippet&type=video&order=viewCount&maxResults=30' +
      '&q=' + encodeURIComponent('artificial intelligence OR AI OR LLM') +
      '&publishedAfter=' + encodeURIComponent(after) + '&key=' + encodeURIComponent(apiKey));
    const ids = (search.items || []).map((i) => i.id.videoId).filter(Boolean);
    if (!ids.length) return [];
    const videos = await getJSON(base + 'videos?part=snippet,statistics&id=' + ids.join(',') +
      '&key=' + encodeURIComponent(apiKey));
    return (videos.items || []).map((v) => L.fromYouTube(v, now));
  }

  window.RadarSources = { loadGithub, loadHN, loadYouTube };
})();
