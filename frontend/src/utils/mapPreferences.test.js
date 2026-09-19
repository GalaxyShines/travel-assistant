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

test('missing display preferences keep labels and routes visible', () => {
  assert.deepEqual(loadMapDisplayPreferences(createStorage()), {
    showPlaceLabels: true,
    showRoutes: true
  });
});

test('saved display preferences are restored on the next load', () => {
  const storage = createStorage();
  saveMapDisplayPreferences({ showPlaceLabels: false, showRoutes: true }, storage);

  assert.deepEqual(loadMapDisplayPreferences(storage), {
    showPlaceLabels: false,
    showRoutes: true
  });
});

test('invalid cached preferences fall back to visible defaults', () => {
  assert.deepEqual(loadMapDisplayPreferences(createStorage('{not-json')), {
    showPlaceLabels: true,
    showRoutes: true
  });
  assert.deepEqual(loadMapDisplayPreferences(createStorage('{"showPlaceLabels":"false"}')), {
    showPlaceLabels: true,
    showRoutes: true
  });
});
