import assert from 'node:assert/strict';
import { test } from 'node:test';

test('map refreshes do not request viewport fitting by default', async () => {
  const module = await import('./mapViewport.js').catch(() => ({}));

  assert.equal(typeof module.shouldFitViewportAfterRender, 'function');
  assert.equal(module.shouldFitViewportAfterRender(), false);
  assert.equal(module.shouldFitViewportAfterRender({ fit: true }), false);
});

test('manual fit actions request viewport fitting', async () => {
  const { shouldFitViewportAfterRender } = await import('./mapViewport.js');

  assert.equal(shouldFitViewportAfterRender({ fitViewport: true }), true);
});
