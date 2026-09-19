export const MAP_INTERACTION_MODES = Object.freeze({
  BROWSE: 'browse',
  PLACE_PICK: 'place-pick',
  ROUTE_PICK: 'route-pick'
});

export function toggleInteractionMode(currentMode, requestedMode) {
  return currentMode === requestedMode ? MAP_INTERACTION_MODES.BROWSE : requestedMode;
}

export function pickRouteEndpoint(startPlaceId, placeId) {
  if (startPlaceId === null || startPlaceId === undefined) {
    return {
      startPlaceId: placeId,
      endPlaceId: null,
      complete: false,
      invalid: false
    };
  }

  if (Number(startPlaceId) === Number(placeId)) {
    return {
      startPlaceId,
      endPlaceId: null,
      complete: false,
      invalid: true
    };
  }

  return {
    startPlaceId,
    endPlaceId: placeId,
    complete: true,
    invalid: false
  };
}

export function clearInteraction() {
  return {
    mode: MAP_INTERACTION_MODES.BROWSE,
    startPlaceId: null
  };
}
