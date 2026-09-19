const STORAGE_KEY = 'travel-helper-map-display-preferences';
const DEFAULT_PREFERENCES = Object.freeze({
  showPlaceLabels: true,
  showRoutes: true
});

function isStorageAvailable(storage) {
  return storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function';
}

export function loadMapDisplayPreferences(storage) {
  if (!isStorageAvailable(storage)) {
    return { ...DEFAULT_PREFERENCES };
  }

  try {
    const rawValue = storage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return { ...DEFAULT_PREFERENCES };
    }

    const stored = JSON.parse(rawValue);
    if (
      !stored ||
      typeof stored !== 'object' ||
      typeof stored.showPlaceLabels !== 'boolean' ||
      typeof stored.showRoutes !== 'boolean'
    ) {
      return { ...DEFAULT_PREFERENCES };
    }

    return {
      showPlaceLabels: stored.showPlaceLabels,
      showRoutes: stored.showRoutes
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function saveMapDisplayPreferences(preferences, storage) {
  if (!isStorageAvailable(storage)) {
    return;
  }

  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      showPlaceLabels: preferences.showPlaceLabels === true,
      showRoutes: preferences.showRoutes === true
    })
  );
}
