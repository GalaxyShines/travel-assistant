import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAP_INTERACTION_MODES,
  clearInteraction,
  toggleInteractionMode
} from './mapInteraction.js';

test('activating the same map mode returns to safe browsing mode', () => {
  assert.equal(
    toggleInteractionMode(MAP_INTERACTION_MODES.PLACE_PICK, MAP_INTERACTION_MODES.PLACE_PICK),
    MAP_INTERACTION_MODES.BROWSE
  );
});

test('clearing interaction restores browse mode and drops the selected start', () => {
  assert.deepEqual(clearInteraction(), {
    mode: MAP_INTERACTION_MODES.BROWSE,
    startPlaceId: null
  });
});
