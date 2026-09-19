export function stopMapClickPropagation(event) {
  const events = [event, event?.domEvent].filter(Boolean);

  events.forEach((currentEvent) => {
    if (typeof currentEvent.stopPropagation === 'function') {
      currentEvent.stopPropagation();
    }

    if ('cancelBubble' in currentEvent) {
      currentEvent.cancelBubble = true;
    }
  });
}

export function shouldHandleMapBackgroundClick(mode) {
  return mode === 'place-pick';
}
