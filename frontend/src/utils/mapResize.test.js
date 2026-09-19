import assert from 'node:assert/strict';
import { test } from 'node:test';
import { syncMapViewport } from './mapResize.js';

test('resizing a map preserves its geographic center after the canvas is recalculated', () => {
  const center = { lng: 106.551, lat: 29.563 };
  const calls = [];
  const map = {
    getCenter() {
      return center;
    },
    checkResize() {
      calls.push('resize');
    },
    setCenter(nextCenter) {
      calls.push(nextCenter);
    }
  };

  assert.equal(syncMapViewport(map), true);
  assert.deepEqual(calls, ['resize', center]);
});

test('an unavailable map does not attempt a resize', () => {
  assert.equal(syncMapViewport(null), false);
  assert.equal(syncMapViewport({}), false);
});

test('resizing a map can request overlay redraw after the canvas is recalculated', () => {
  const calls = [];
  const map = {
    checkResize() {
      calls.push('resize');
    }
  };

  assert.equal(
    syncMapViewport(map, () => {
      calls.push('redraw-overlays');
    }),
    true
  );
  assert.deepEqual(calls, ['resize', 'redraw-overlays']);
});
