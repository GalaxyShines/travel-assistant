export const travelModeOptions = [
  { label: '驾车', value: 'driving' },
  { label: '步行', value: 'walking' },
  { label: '公交', value: 'transit' },
  { label: '骑行', value: 'riding' }
];

export function getTravelModeLabel(mode) {
  return travelModeOptions.find((item) => item.value === mode)?.label || '驾车';
}

export function buildBaiduNavigationUrl(fromPlace, toPlace, mode = 'driving') {
  const url = new URL('https://api.map.baidu.com/direction');
  url.searchParams.set('origin', `${fromPlace.lat},${fromPlace.lng}`);
  url.searchParams.set('destination', `${toPlace.lat},${toPlace.lng}`);
  url.searchParams.set('mode', mode);
  url.searchParams.set('region', '全国');
  url.searchParams.set('coord_type', 'bd09ll');
  url.searchParams.set('output', 'html');
  url.searchParams.set('src', 'travel-helper');
  return url.toString();
}

export function openBaiduNavigation(fromPlace, toPlace, mode) {
  window.open(buildBaiduNavigationUrl(fromPlace, toPlace, mode), '_blank', 'noopener,noreferrer');
}
