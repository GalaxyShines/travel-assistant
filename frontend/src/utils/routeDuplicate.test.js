import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasDuplicateRoute } from './routeDuplicate.js';

const routes = [
  { id: 1, from_place_id: 2, to_place_id: 3 },
  { id: 2, from_place_id: 4, to_place_id: 5 }
];

test('same-direction route is detected even when ids are strings', () => {
  assert.equal(hasDuplicateRoute(routes, { from_place_id: '2', to_place_id: '3' }), true);
});

test('reverse direction is not considered a duplicate', () => {
  assert.equal(hasDuplicateRoute(routes, { from_place_id: 3, to_place_id: 2 }), false);
});

test('editing a route does not consider itself a duplicate', () => {
  assert.equal(hasDuplicateRoute(routes, { from_place_id: 2, to_place_id: 3 }, 1), false);
});
