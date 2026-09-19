import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAP_INTERACTION_MODES,
  clearInteraction,
  pickRouteEndpoint,
  toggleInteractionMode
} from './mapInteraction.js';

test('activating the same map mode returns to safe browsing mode', () => {
  assert.equal(
    toggleInteractionMode(MAP_INTERACTION_MODES.PLACE_PICK, MAP_INTERACTION_MODES.PLACE_PICK),
    MAP_INTERACTION_MODES.BROWSE
  );
});

test('route picking records a start before completing with another point', () => {
  assert.deepEqual(pickRouteEndpoint(null, 4), {
    startPlaceId: 4,
    endPlaceId: null,
    complete: false,
    invalid: false
  });
  assert.deepEqual(pickRouteEndpoint(4, 9), {
    startPlaceId: 4,
    endPlaceId: 9,
    complete: true,
    invalid: false
  });
});

test('route picking rejects the same place as an endpoint', () => {
  assert.deepEqual(pickRouteEndpoint(4, 4), {
    startPlaceId: 4,
    endPlaceId: null,
    complete: false,
    invalid: true
  });
});

test('clearing interaction restores browse mode and drops the selected start', () => {
  assert.deepEqual(clearInteraction(), {
    mode: MAP_INTERACTION_MODES.BROWSE,
    startPlaceId: null
  });
});
