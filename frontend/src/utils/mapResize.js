export function syncMapViewport(map, afterResize = null) {
  if (!map || typeof map.checkResize !== 'function') {
    return false;
  }

  const center = typeof map.getCenter === 'function' ? map.getCenter() : null;
  map.checkResize();
  afterResize?.();

  if (center && typeof map.setCenter === 'function') {
    map.setCenter(center);
  }

  return true;
}
