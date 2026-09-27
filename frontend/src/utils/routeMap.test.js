import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as routeMap from './routeMap.js';
import {
  assignSharedSegmentSlots,
  buildPlaceBadges,
  contrastTextColor,
  expandRouteSegments,
  offsetSegmentPixels
} from './routeMap.js';

test('route arrows are white and repeat every 60 pixels inside the line', () => {
  assert.equal(typeof routeMap.createRouteArrowIcons, 'function');

  class MapSymbol {
    constructor(shape, options) {
      this.shape = shape;
      this.options = options;
    }
  }

  class IconSequence {
    constructor(symbol, offset, repeat, fixedRotation) {
      this.symbol = symbol;
      this.offset = offset;
      this.repeat = repeat;
      this.fixedRotation = fixedRotation;
    }
  }

  const icons = routeMap.createRouteArrowIcons(
    { Symbol: MapSymbol, IconSequence },
    'forward-closed-arrow'
  );

  assert.equal(icons.length, 1);
  assert.equal(icons[0].symbol.shape, 'forward-closed-arrow');
  assert.deepEqual(icons[0].symbol.options, {
    scale: 0.6,
    strokeColor: '#FFFFFF',
    fillColor: '#FFFFFF',
    fillOpacity: 1
  });
  assert.equal(icons[0].offset, '20px');
  assert.equal(icons[0].repeat, '60px');
  assert.equal(icons[0].fixedRotation, false);
});

test('routes expand to directed adjacent segments and repeated-place badges', () => {
  const routes = [{ id: 7, color: '#DC2626', order_index: 0, stops: [
    { place_id: 1, stop_index: 1, lng: 1, lat: 1 },
    { place_id: 2, stop_index: 2, lng: 2, lat: 2 },
    { place_id: 1, stop_index: 3, lng: 1, lat: 1 }
  ] }];
  assert.equal(expandRouteSegments(routes).length, 2);
  assert.deepEqual(buildPlaceBadges(routes).get(1).map((item) => item.number), [1, 3]);
});

test('place badges are ordered by stop number across routes', () => {
  const routes = [
    { id: 1, color: '#DC2626', order_index: 0, stops: [
      { place_id: 10, stop_index: 1 },
      { place_id: 20, stop_index: 2 },
      { place_id: 30, stop_index: 3 }
    ] },
    { id: 2, color: '#2563EB', order_index: 1, stops: [
      { place_id: 30, stop_index: 1 },
      { place_id: 40, stop_index: 2 }
    ] }
  ];

  assert.deepEqual(buildPlaceBadges(routes).get(30).map((item) => item.number), [1, 3]);
});

test('opposite directions share parallel slots but keep opposite vectors', () => {
  const assigned = assignSharedSegmentSlots([
    { routeId: 1, routeOrder: 0, segmentIndex: 0, fromPlaceId: 10, toPlaceId: 20 },
    { routeId: 2, routeOrder: 1, segmentIndex: 0, fromPlaceId: 20, toPlaceId: 10 }
  ]);
  assert.deepEqual(assigned.map((item) => item.slot), [-0.5, 0.5]);
  assert.deepEqual(assigned.map((item) => item.directedSlot), [-0.5, -0.5]);
  const first = offsetSegmentPixels({ x: 0, y: 0 }, { x: 100, y: 0 }, assigned[0].directedSlot, 8);
  const reverse = offsetSegmentPixels({ x: 100, y: 0 }, { x: 0, y: 0 }, assigned[1].directedSlot, 8);
  assert.notEqual(first.from.y, reverse.from.y);
});

test('three shared segments receive stable centered slots', () => {
  const assigned = assignSharedSegmentSlots([
    { routeId: 3, routeOrder: 2, segmentIndex: 0, fromPlaceId: 1, toPlaceId: 2 },
    { routeId: 1, routeOrder: 0, segmentIndex: 0, fromPlaceId: 1, toPlaceId: 2 },
    { routeId: 2, routeOrder: 1, segmentIndex: 0, fromPlaceId: 1, toPlaceId: 2 }
  ]);
  const byRoute = new Map(assigned.map((item) => [item.routeId, item.slot]));
  assert.deepEqual([...byRoute.entries()], [[3, 1], [1, -1], [2, 0]]);
});

test('contrast color is readable for bright and dark route colors', () => {
  assert.equal(contrastTextColor('#FACC15'), '#111827');
  assert.equal(contrastTextColor('#2563EB'), '#FFFFFF');
});
