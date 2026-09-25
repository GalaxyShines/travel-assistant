import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  loadHiddenRouteIds,
  saveHiddenRouteIds,
  visibleRouteIds
} from './routeVisibility.js';

function memoryStorage(values = {}) {
  const data = new Map(Object.entries(values));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, value); },
    value(key) { return data.get(key); }
  };
}

test('corrupt storage defaults current routes to visible', () => {
  const storage = { getItem: () => '{bad', setItem() {} };
  assert.deepEqual(loadHiddenRouteIds(3, [{ id: 1 }, { id: 2 }], storage), new Set());
});

test('hidden ids are isolated by trip and stale ids are removed', () => {
  const storage = memoryStorage({
    'travel-helper-hidden-routes:3': JSON.stringify([1, 99]),
    'travel-helper-hidden-routes:4': JSON.stringify([2])
  });

  assert.deepEqual([...loadHiddenRouteIds(3, [{ id: 1 }, { id: 2 }], storage)], [1]);
  assert.equal(storage.value('travel-helper-hidden-routes:3'), '[1]');
  assert.equal(storage.value('travel-helper-hidden-routes:4'), '[2]');
});

test('saved hidden ids are numeric and newly created routes remain visible', () => {
  const storage = memoryStorage();
  saveHiddenRouteIds(3, new Set(['2']), storage);

  const hidden = loadHiddenRouteIds(3, [{ id: 1 }, { id: 2 }, { id: 3 }], storage);
  assert.deepEqual(visibleRouteIds([{ id: 1 }, { id: 2 }, { id: 3 }], hidden), [1, 3]);
});
