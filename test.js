const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./lib.js');

const NOW = Date.parse('2026-10-19T12:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();

test('ageDays: не меньше суток и устойчив к некорректной дате', () => {
  assert.equal(L.ageDays(daysAgo(0.1), NOW), 1);
  assert.equal(L.ageDays(daysAgo(4), NOW), 4);
  assert.equal(L.ageDays('не дата', NOW), 1);
});

test('fromGithub: темп = звёзды в день с момента создания', () => {
  const it = L.fromGithub({ full_name: 'a/b', html_url: 'https://github.com/a/b', created_at: daysAgo(4), stargazers_count: 400, description: null }, NOW);
  assert.equal(it.growth, 100);
  assert.equal(it.growthLabel, '+100 ★/день');
  assert.equal(it.growthValue, '+100');
  assert.equal(it.growthUnit, '★/день');
  assert.equal(it.description, '');
  assert.equal(it.source, 'github');
});

test('fromHN: ссылка на обсуждение, домен в описании, пустые очки не ломают расчёт', () => {
  const it = L.fromHN({ objectID: '42', title: 'T', url: 'https://www.example.com/x', points: null, created_at: daysAgo(2) }, NOW);
  assert.equal(it.url, 'https://news.ycombinator.com/item?id=42');
  assert.equal(it.description, 'example.com');
  assert.equal(it.growth, 0);
});

test('fromYouTube: просмотры приходят строкой', () => {
  const it = L.fromYouTube({ id: 'abc', snippet: { title: 'V', channelTitle: 'Ch', publishedAt: daysAgo(2) }, statistics: { viewCount: '2000' } }, NOW);
  assert.equal(it.popularity, 2000);
  assert.equal(it.growth, 1000);
  assert.equal(it.url, 'https://www.youtube.com/watch?v=abc');
  assert.equal(it.growthValue, '1K');
});

test('formatNumber', () => {
  assert.equal(L.formatNumber(999), '999');
  assert.equal(L.formatNumber(1500), '1.5K');
  assert.equal(L.formatNumber(1000), '1K');
  assert.equal(L.formatNumber(12400), '12K');
  assert.equal(L.formatNumber(2500000), '2.5M');
});

test('withScores: нормализация по лидеру своего источника', () => {
  const items = [
    { source: 'github', growth: 100, popularity: 400 },
    { source: 'github', growth: 50, popularity: 800 },
    { source: 'youtube', growth: 1000000, popularity: 5 },
  ];
  const s = L.withScores(items);
  assert.equal(s[0].growthScore, 1);
  assert.equal(s[1].growthScore, 0.5);
  assert.equal(s[2].growthScore, 1);
  assert.equal(s[1].popularityScore, 1);
});

test('filterItems: все слова обязательны, ищет по источнику и без учёта регистра', () => {
  const items = [
    { title: 'Agent Kit', description: 'tools', source: 'github' },
    { title: 'Local LLM', description: 'agent runner', source: 'hackernews' },
  ];
  assert.equal(L.filterItems(items, '').length, 2);
  assert.equal(L.filterItems(items, 'AGENT').length, 2);
  assert.equal(L.filterItems(items, 'agent hackernews').length, 1);
  assert.equal(L.filterItems(items, 'нет такого').length, 0);
});

test('sortItems: рост, дата, популярность; в обзоре сравниваются нормализованные значения', () => {
  const items = [
    { id: 'a', date: daysAgo(5), growth: 10, popularity: 900, growthScore: 0.2, popularityScore: 1 },
    { id: 'b', date: daysAgo(1), growth: 50, popularity: 100, growthScore: 0.9, popularityScore: 0.1 },
    { id: 'c', date: daysAgo(3), growth: 30, popularity: 500, growthScore: 1, popularityScore: 0.5 },
  ];
  const ids = (arr) => arr.map((i) => i.id).join('');
  assert.equal(ids(L.sortItems(items, 'growth', false)), 'bca');
  assert.equal(ids(L.sortItems(items, 'growth', true)), 'cba');
  assert.equal(ids(L.sortItems(items, 'date', false)), 'bca');
  assert.equal(ids(L.sortItems(items, 'popularity', false)), 'acb');
  assert.equal(ids(items), 'abc', 'исходный массив не изменяется');
});

test('relativeDate', () => {
  assert.equal(L.relativeDate(daysAgo(0.001), NOW), 'только что');
  assert.equal(L.relativeDate(daysAgo(0.25), NOW), '6 ч назад');
  assert.equal(L.relativeDate(daysAgo(3.4), NOW), '3 дн. назад');
});

test('dedupe и isoDaysAgo', () => {
  assert.equal(L.dedupe([{ id: 1 }, { id: 2 }, { id: 1 }]).length, 2);
  assert.equal(L.isoDaysAgo(7, NOW), '2026-10-12T12:00:00.000Z');
});
