export const MAP_INTERACTION_MODES = Object.freeze({
  BROWSE: 'browse',
  PLACE_PICK: 'place-pick'
});

export function toggleInteractionMode(currentMode, requestedMode) {
  return currentMode === requestedMode ? MAP_INTERACTION_MODES.BROWSE : requestedMode;
}

export function clearInteraction() {
  return {
    mode: MAP_INTERACTION_MODES.BROWSE,
    startPlaceId: null
  };
}
