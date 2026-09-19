export function createEmptyRouteForm(orderIndex = 0) {
  return {
    id: null,
    from_place_id: null,
    to_place_id: null,
    travel_mode: 'driving',
    order_index: orderIndex,
    version: null
  };
}

export function routeFormFromRoute(route) {
  return {
    id: route.id,
    from_place_id: route.from_place_id,
    to_place_id: route.to_place_id,
    travel_mode: route.travel_mode || 'driving',
    order_index: Number(route.order_index || 0),
    version: route.version === undefined || route.version === null ? null : Number(route.version)
  };
}

export function routePayloadFromForm(form) {
  const payload = {
    from_place_id: form.from_place_id,
    to_place_id: form.to_place_id,
    travel_mode: form.travel_mode,
    order_index: form.order_index
  };

  if (Number.isInteger(Number(form.version))) {
    payload.version = Number(form.version);
  }

  return payload;
}

export function swapRoutePlaces(form) {
  const fromPlaceId = form.from_place_id;
  form.from_place_id = form.to_place_id;
  form.to_place_id = fromPlaceId;
}
