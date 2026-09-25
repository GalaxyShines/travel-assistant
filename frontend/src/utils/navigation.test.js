import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildBaiduDrivingUrl,
  getCurrentCoordinates,
  navigateToPlace
} from './navigation.js';

const place = { name: '洪崖洞', lat: 29.56, lng: 106.58 };
const successfulGeolocation = {
  getCurrentPosition(resolve, _reject, options) {
    assert.deepEqual(options, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 30_000
    });
    resolve({ coords: { latitude: 29.5, longitude: 106.5 } });
  }
};

test('driving URL uses explicit BD-09 origin and destination', () => {
  const url = new URL(buildBaiduDrivingUrl(
    { name: '当前位置', lat: 29.5, lng: 106.5 },
    place
  ));
  assert.equal(url.searchParams.get('mode'), 'driving');
  assert.match(url.searchParams.get('origin'), /29\.5,106\.5/);
  assert.match(url.searchParams.get('destination'), /洪崖洞/);
  assert.equal(url.searchParams.get('coord_type'), 'bd09ll');
});

test('current coordinates use the browser geolocation contract', async () => {
  assert.deepEqual(await getCurrentCoordinates(successfulGeolocation), {
    lng: 106.5,
    lat: 29.5
  });
});

test('conversion failure does not open an invalid URL', async () => {
  let opened = false;
  await assert.rejects(() => navigateToPlace(place, {
    geolocation: successfulGeolocation,
    convertToBaiduPoint: async () => { throw new Error('convert failed'); },
    openWindow: () => { opened = true; }
  }), /convert failed/);
  assert.equal(opened, false);
});

test('navigation converts current position then opens fixed driving mode', async () => {
  let openedUrl = null;
  await navigateToPlace(place, {
    geolocation: successfulGeolocation,
    convertToBaiduPoint: async ({ lng, lat }) => ({ lng: lng + 0.01, lat: lat + 0.01 }),
    openWindow: (url) => { openedUrl = new URL(url); }
  });

  assert.equal(openedUrl.searchParams.get('mode'), 'driving');
  assert.match(openedUrl.searchParams.get('origin'), /29\.51,106\.51/);
});
