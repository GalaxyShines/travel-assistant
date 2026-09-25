const KEY_PREFIX = 'travel-helper-hidden-routes:';

function isStorageAvailable(storage) {
  return storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function';
}

function storageKey(tripId) {
  return `${KEY_PREFIX}${tripId}`;
}

export function saveHiddenRouteIds(tripId, ids, storage) {
  if (!isStorageAvailable(storage)) return;
  const normalized = [...new Set([...ids].map(Number).filter(Number.isFinite))];
  storage.setItem(storageKey(tripId), JSON.stringify(normalized));
}

export function loadHiddenRouteIds(tripId, routes, storage) {
  if (!isStorageAvailable(storage)) return new Set();
  const currentIds = new Set(routes.map((route) => Number(route.id)).filter(Number.isFinite));
  let storedIds = [];

  try {
    const decoded = JSON.parse(storage.getItem(storageKey(tripId)) || '[]');
    if (Array.isArray(decoded) && decoded.every((id) => Number.isFinite(Number(id)))) {
      storedIds = decoded.map(Number);
    }
  } catch {
    storedIds = [];
  }

  const hiddenIds = new Set(storedIds.filter((id) => currentIds.has(id)));
  saveHiddenRouteIds(tripId, hiddenIds, storage);
  return hiddenIds;
}

export function visibleRouteIds(routes, hiddenIds) {
  return routes
    .map((route) => Number(route.id))
    .filter((id) => Number.isFinite(id) && !hiddenIds.has(id));
}
