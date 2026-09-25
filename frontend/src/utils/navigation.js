function assertCoordinates(point, label) {
  const lng = Number(point?.lng);
  const lat = Number(point?.lat);
  if (![lng, lat].every(Number.isFinite)) {
    throw new Error(`${label}坐标无效`);
  }
  return { ...point, lng, lat };
}

function formatPoint(point) {
  const normalized = assertCoordinates(point, point?.name || '地点');
  return `latlng:${normalized.lat},${normalized.lng}|name:${normalized.name || '未命名地点'}`;
}

export function getCurrentCoordinates(geolocation, options = {}) {
  if (!geolocation || typeof geolocation.getCurrentPosition !== 'function') {
    return Promise.reject(new Error('当前浏览器不支持定位'));
  }
  const positionOptions = {
    enableHighAccuracy: true,
    timeout: 10_000,
    maximumAge: 30_000,
    ...options
  };
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) => resolve({
        lng: Number(position.coords.longitude),
        lat: Number(position.coords.latitude)
      }),
      reject,
      positionOptions
    );
  });
}

export function buildBaiduDrivingUrl(origin, destination) {
  const url = new URL('https://api.map.baidu.com/direction');
  url.searchParams.set('origin', formatPoint(origin));
  url.searchParams.set('destination', formatPoint(destination));
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('region', '全国');
  url.searchParams.set('coord_type', 'bd09ll');
  url.searchParams.set('output', 'html');
  url.searchParams.set('src', 'travel-helper');
  return url.toString();
}

export function buildBaiduSelfLocateDrivingUrl(place) {
  const destination = assertCoordinates(place, place?.name || '目的地');
  const url = new URL('https://api.map.baidu.com/direction');
  url.searchParams.set('origin', 'name:我的位置');
  url.searchParams.set('destination', formatPoint(destination));
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('region', '全国');
  url.searchParams.set('coord_type', 'bd09ll');
  url.searchParams.set('output', 'html');
  url.searchParams.set('src', 'travel-helper');
  return url.toString();
}

export async function navigateToPlace(place, dependencies = {}) {
  const geolocation = dependencies.geolocation ?? globalThis.navigator?.geolocation;
  const convertToBaiduPoint = dependencies.convertToBaiduPoint;
  const openWindow = dependencies.openWindow ?? ((url) => {
    globalThis.window?.open(url, '_blank', 'noopener,noreferrer');
  });
  if (typeof convertToBaiduPoint !== 'function') {
    throw new Error('地图坐标转换尚未就绪');
  }

  const wgs84 = await getCurrentCoordinates(geolocation);
  const origin = assertCoordinates(await convertToBaiduPoint(wgs84), '当前位置');
  const destination = assertCoordinates(place, place?.name || '目的地');
  const url = buildBaiduDrivingUrl({ ...origin, name: '当前位置' }, destination);
  openWindow(url);
  return url;
}
