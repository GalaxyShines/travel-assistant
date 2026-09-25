import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadMapDisplayPreferences, saveMapDisplayPreferences } from './mapPreferences.js';

function createStorage(initialValue = null) {
  let value = initialValue;
  return {
    getItem() {
      return value;
    },
    setItem(_key, nextValue) {
      value = nextValue;
    }
  };
}

test('missing display preferences keep place labels visible', () => {
  assert.deepEqual(loadMapDisplayPreferences(createStorage()), {
    showPlaceLabels: true
  });
});

test('saved display preferences are restored on the next load', () => {
  const storage = createStorage();
  saveMapDisplayPreferences({ showPlaceLabels: false }, storage);

  assert.deepEqual(loadMapDisplayPreferences(storage), {
    showPlaceLabels: false
  });
});

test('invalid cached preferences fall back to visible defaults', () => {
  assert.deepEqual(loadMapDisplayPreferences(createStorage('{not-json')), {
    showPlaceLabels: true
  });
  assert.deepEqual(loadMapDisplayPreferences(createStorage('{"showPlaceLabels":"false"}')), {
    showPlaceLabels: true
  });
});

test('legacy showRoutes false is ignored while the label preference is retained', () => {
  const storage = createStorage(JSON.stringify({
    showPlaceLabels: false,
    showRoutes: false
  }));

  assert.deepEqual(loadMapDisplayPreferences(storage), {
    showPlaceLabels: false
  });
});
