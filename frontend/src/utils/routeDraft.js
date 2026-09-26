function mutationResult(placeIds, changed, mergedAdjacent = false, error = null) {
  return {
    placeIds,
    changed,
    mergedAdjacent,
    error
  };
}

export function appendStop(placeIds, placeId) {
  const normalizedId = Number(placeId);
  if (Number(placeIds.at(-1)) === normalizedId) {
    return mutationResult([...placeIds], false, false, 'adjacent-duplicate');
  }

  return mutationResult([...placeIds, normalizedId], true);
}

export function getOccurrenceNumbers(placeIds, placeId) {
  return placeIds.flatMap((id, index) =>
    Number(id) === Number(placeId) ? [index + 1] : []
  );
}

function collapseAdjacent(placeIds) {
  return placeIds.reduce((normalized, placeId) => {
    const numericId = Number(placeId);
    if (normalized.at(-1) !== numericId) {
      normalized.push(numericId);
    }
    return normalized;
  }, []);
}

function hasAdjacentDuplicates(placeIds) {
  return placeIds.some(
    (placeId, index) => index > 0 && Number(placeId) === Number(placeIds[index - 1])
  );
}

export function removeStopAt(placeIds, index) {
  if (!Number.isInteger(index) || index < 0 || index >= placeIds.length) {
    return mutationResult([...placeIds], false);
  }

  const removed = placeIds.filter((_, currentIndex) => currentIndex !== index).map(Number);
  const normalized = collapseAdjacent(removed);
  return mutationResult(normalized, true, normalized.length !== removed.length);
}

export function removeAllStops(placeIds, placeId) {
  const normalizedId = Number(placeId);
  const removed = placeIds.filter((id) => Number(id) !== normalizedId).map(Number);
  const normalized = collapseAdjacent(removed);
  return mutationResult(
    normalized,
    removed.length !== placeIds.length,
    normalized.length !== removed.length
  );
}

export function moveStop(placeIds, fromIndex, toIndex) {
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= placeIds.length ||
    toIndex >= placeIds.length ||
    fromIndex === toIndex
  ) {
    return mutationResult([...placeIds], false);
  }

  const candidate = placeIds.map(Number);
  const [moved] = candidate.splice(fromIndex, 1);
  candidate.splice(toIndex, 0, moved);

  return hasAdjacentDuplicates(candidate)
    ? mutationResult([...placeIds], false, false, 'adjacent-duplicate')
    : mutationResult(candidate, true);
}

export function undoStops(history) {
  const previous = history.at(-1);
  return previous ? [...previous] : null;
}

export function createRouteDraft(orderIndex = 0) {
  return {
    id: null,
    name: '',
    color: '#D97706',
    placeIds: [],
    orderIndex: Number(orderIndex) || 0,
    version: null
  };
}

export function routeToDraft(route) {
  return {
    id: Number(route.id),
    name: String(route.name || ''),
    color: String(route.color || '#D97706').toUpperCase(),
    placeIds: Array.isArray(route.stops)
      ? route.stops.map((stop) => Number(stop.place_id))
      : [],
    orderIndex: Number(route.order_index) || 0,
    version:
      route.version === undefined || route.version === null
        ? null
        : Number(route.version)
  };
}

export function routeDraftPayload(draft) {
  const payload = {
    name: String(draft.name || '').trim(),
    color: String(draft.color || '#D97706').toUpperCase(),
    place_ids: draft.placeIds.map(Number),
    order_index: Number(draft.orderIndex) || 0
  };

  if (
    draft.version !== undefined &&
    draft.version !== null &&
    draft.version !== '' &&
    Number.isInteger(Number(draft.version))
  ) {
    payload.version = Number(draft.version);
  }

  return payload;
}

export function routeDraftFingerprint(draft) {
  return JSON.stringify({
    id: draft.id === null || draft.id === undefined ? null : Number(draft.id),
    name: String(draft.name || ''),
    color: String(draft.color || '#D97706').toUpperCase(),
    placeIds: (draft.placeIds || []).map(Number),
    orderIndex: Number(draft.orderIndex) || 0,
    version: draft.version === null || draft.version === undefined ? null : Number(draft.version)
  });
}

export function isRouteDraftDirty(draft, initialFingerprint) {
  return routeDraftFingerprint(draft) !== initialFingerprint;
}
