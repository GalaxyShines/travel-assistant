function sortedStops(route) {
  return [...(route.stops || [])].sort(
    (left, right) => Number(left.stop_index) - Number(right.stop_index)
  );
}

export function expandRouteSegments(routes) {
  return routes.flatMap((route) => {
    const stops = sortedStops(route);
    return stops.slice(0, -1).map((stop, segmentIndex) => {
      const next = stops[segmentIndex + 1];
      return {
        routeId: Number(route.id),
        routeName: route.name,
        routeOrder: Number(route.order_index || 0),
        color: route.color,
        segmentIndex,
        fromPlaceId: Number(stop.place_id),
        toPlaceId: Number(next.place_id),
        from: { lng: Number(stop.lng), lat: Number(stop.lat) },
        to: { lng: Number(next.lng), lat: Number(next.lat) }
      };
    });
  });
}

function segmentKey(segment) {
  const fromId = Number(segment.fromPlaceId);
  const toId = Number(segment.toPlaceId);
  return fromId <= toId ? `${fromId}:${toId}` : `${toId}:${fromId}`;
}

export function assignSharedSegmentSlots(segments) {
  const result = segments.map((segment) => ({ ...segment }));
  const groups = new Map();
  result.forEach((segment) => {
    const key = segmentKey(segment);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(segment);
  });

  groups.forEach((group) => {
    group.sort((left, right) => (
      Number(left.routeOrder || 0) - Number(right.routeOrder || 0)
      || Number(left.routeId) - Number(right.routeId)
      || Number(left.segmentIndex || 0) - Number(right.segmentIndex || 0)
    ));
    const center = (group.length - 1) / 2;
    group.forEach((segment, index) => {
      const slot = index - center;
      const canonicalDirection = Number(segment.fromPlaceId) <= Number(segment.toPlaceId) ? 1 : -1;
      segment.slot = slot;
      segment.directedSlot = slot * canonicalDirection;
    });
  });

  return result;
}

export function offsetSegmentPixels(from, to, directedSlot, gap = 8) {
  const dx = Number(to.x) - Number(from.x);
  const dy = Number(to.y) - Number(from.y);
  const length = Math.hypot(dx, dy);
  if (!length || !Number.isFinite(length)) {
    return { from: { ...from }, to: { ...to } };
  }
  const offset = Number(directedSlot || 0) * Number(gap || 0);
  const offsetX = (-dy / length) * offset;
  const offsetY = (dx / length) * offset;
  return {
    from: { x: Number(from.x) + offsetX, y: Number(from.y) + offsetY },
    to: { x: Number(to.x) + offsetX, y: Number(to.y) + offsetY }
  };
}

export function buildPlaceBadges(routes) {
  const badges = new Map();
  routes.forEach((route) => {
    sortedStops(route).forEach((stop, index) => {
      const placeId = Number(stop.place_id);
      if (!badges.has(placeId)) badges.set(placeId, []);
      badges.get(placeId).push({
        routeId: Number(route.id),
        number: index + 1,
        color: route.color,
        routeOrder: Number(route.order_index || 0)
      });
    });
  });
  badges.forEach((items) => items.sort((left, right) => (
    left.routeOrder - right.routeOrder
    || left.routeId - right.routeId
    || left.number - right.number
  )));
  return badges;
}

function linearChannel(hexPair) {
  const channel = Number.parseInt(hexPair, 16) / 255;
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

export function contrastTextColor(hex) {
  const normalized = /^#[0-9A-F]{6}$/i.test(hex || '') ? hex.slice(1) : 'D97706';
  const luminance = 0.2126 * linearChannel(normalized.slice(0, 2))
    + 0.7152 * linearChannel(normalized.slice(2, 4))
    + 0.0722 * linearChannel(normalized.slice(4, 6));
  return luminance > 0.45 ? '#111827' : '#FFFFFF';
}
