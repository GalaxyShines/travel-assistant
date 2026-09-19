import assert from 'node:assert/strict';
import { test } from 'node:test';

test('stale drawer close events keep the newly opened overlay visible', async () => {
  const module = await import('./mobileOverlay.js').catch(() => ({}));

  assert.equal(typeof module.resolveMobileOverlayClose, 'function');
  assert.equal(module.resolveMobileOverlayClose('place-form', 'place-detail'), 'place-form');
});

test('active drawer close events clear the current overlay', async () => {
  const { resolveMobileOverlayClose } = await import('./mobileOverlay.js');

  assert.equal(resolveMobileOverlayClose('place-detail', 'place-detail'), null);
  assert.equal(resolveMobileOverlayClose('place-form', 'place-form'), null);
});

test('generic close events clear the current overlay', async () => {
  const { resolveMobileOverlayClose } = await import('./mobileOverlay.js');

  assert.equal(resolveMobileOverlayClose('search-results'), null);
});
