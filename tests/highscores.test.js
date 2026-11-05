import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHighScores, STORAGE_KEY, MAX_ENTRIES } from '../src/storage/highscores.js';

function memoryStorage() {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test('entries are kept sorted high to low and ranked', () => {
  const hs = createHighScores(memoryStorage());
  hs.add({ name: 'A', score: 3, difficulty: 'easy' }, 1);
  const res = hs.add({ name: 'B', score: 9, difficulty: 'hard' }, 2);
  assert.equal(res.rank, 1);
  assert.deepEqual(hs.list().map((e) => e.name), ['B', 'A']);
});

test('ties rank below existing entries with the same score', () => {
  const hs = createHighScores(memoryStorage());
  hs.add({ name: 'first', score: 5, difficulty: 'normal' }, 1);
  const res = hs.add({ name: 'second', score: 5, difficulty: 'normal' }, 2);
  assert.equal(res.rank, 2);
  assert.deepEqual(hs.list().map((e) => e.name), ['first', 'second']);
});

test('only the top 10 are kept, and a non-qualifying score is not stored', () => {
  const storage = memoryStorage();
  const hs = createHighScores(storage);
  for (let i = 1; i <= MAX_ENTRIES; i += 1) hs.add({ name: `P${i}`, score: 10 * i, difficulty: 'normal' }, i);
  assert.equal(hs.list().length, MAX_ENTRIES);

  const miss = hs.add({ name: 'low', score: 1, difficulty: 'normal' }, 99);
  assert.deepEqual(miss, { rank: 0, persisted: false });
  assert.equal(hs.list().length, MAX_ENTRIES);
  assert.ok(!hs.list().some((e) => e.name === 'low'));
});

test('corrupt or foreign storage is treated as empty', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, '{not json');
  assert.deepEqual(createHighScores(storage).list(), []);

  storage.setItem(STORAGE_KEY, JSON.stringify({ v: 99, entries: [{ name: 'x', score: 1 }] }));
  assert.deepEqual(createHighScores(storage).list(), []);
});

test('a storage that throws on write reports persisted: false', () => {
  const storage = memoryStorage();
  storage.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  const res = createHighScores(storage).add({ name: 'A', score: 4, difficulty: 'easy' });
  assert.deepEqual(res, { rank: 1, persisted: false });
});

test('with no storage at all, scores are ranked but not persisted', () => {
  const hs = createHighScores(null);
  assert.deepEqual(hs.add({ name: 'A', score: 4, difficulty: 'easy' }), { rank: 1, persisted: false });
  assert.deepEqual(hs.list(), []);
});
