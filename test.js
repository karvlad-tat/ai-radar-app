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
  assert.equal(L.formatNumber(999600), '1M');
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

test('sortItems: рост, дата, популярность; исходный массив не меняется', () => {
  const items = [
    { id: 'a', date: daysAgo(5), growth: 10, popularity: 900 },
    { id: 'b', date: daysAgo(1), growth: 50, popularity: 100 },
    { id: 'c', date: daysAgo(3), growth: 30, popularity: 500 },
  ];
  const ids = (arr) => arr.map((i) => i.id).join('');
  assert.equal(ids(L.sortItems(items, 'growth')), 'bca');
  assert.equal(ids(L.sortItems(items, 'date')), 'bca');
  assert.equal(ids(L.sortItems(items, 'popularity')), 'acb');
  assert.equal(ids(items), 'abc');
});

test('sortItems: некорректная дата уходит в конец и не ломает порядок', () => {
  const items = [
    { id: 'x', date: 'не дата', growth: 1, popularity: 1 },
    { id: 'a', date: daysAgo(2), growth: 1, popularity: 1 },
    { id: 'b', date: daysAgo(1), growth: 1, popularity: 1 },
  ];
  assert.equal(L.sortItems(items, 'date').map((i) => i.id).join(''), 'bax');
});

test('fromYouTube: запись без snippet и статистики не падает', () => {
  const it = L.fromYouTube({ id: 'z' }, NOW);
  assert.equal(it.title, '(без названия)');
  assert.equal(it.popularity, 0);
});

test('relativeDate: пустая строка для неверной даты', () => {
  assert.equal(L.relativeDate('не дата', NOW), '');
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
