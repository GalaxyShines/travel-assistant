import assert from 'node:assert/strict';
import { test } from 'node:test';

test('marker clicks stop propagation to the map click handler', async () => {
  const module = await import('./mapEvents.js').catch(() => ({}));

  assert.equal(typeof module.stopMapClickPropagation, 'function');

  let stopped = false;
  module.stopMapClickPropagation({
    domEvent: {
      stopPropagation() {
        stopped = true;
      }
    }
  });

  assert.equal(stopped, true);
});

test('marker clicks mark both wrapped and DOM events as handled', async () => {
  const { stopMapClickPropagation } = await import('./mapEvents.js');
  const event = {
    cancelBubble: false,
    domEvent: {
      cancelBubble: false
    }
  };

  stopMapClickPropagation(event);

  assert.equal(event.cancelBubble, true);
  assert.equal(event.domEvent.cancelBubble, true);
});

test('only deliberate map point mode accepts background map clicks', async () => {
  const { shouldHandleMapBackgroundClick } = await import('./mapEvents.js');

  assert.equal(shouldHandleMapBackgroundClick('place-pick'), true);
  assert.equal(shouldHandleMapBackgroundClick('browse'), false);
  assert.equal(shouldHandleMapBackgroundClick('route-pick'), false);
});
