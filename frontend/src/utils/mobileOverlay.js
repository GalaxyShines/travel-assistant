export function resolveMobileOverlayClose(currentOverlay, closedOverlay = null) {
  if (closedOverlay && currentOverlay !== closedOverlay) {
    return currentOverlay;
  }

  return null;
}
