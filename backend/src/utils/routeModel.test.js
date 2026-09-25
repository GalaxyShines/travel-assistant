const assert = require('node:assert/strict');
const test = require('node:test');

test('route validation accepts non-adjacent repeats and rejects adjacent repeats', () => {
  const { validatePlaceIds } = require('./routeModel');

  assert.deepEqual(validatePlaceIds([1, 2, 1]), [1, 2, 1]);
  assert.throws(() => validatePlaceIds([1, 1, 2]), /相邻地点不能相同/);
});

test('route fields are normalized and color is canonical uppercase hex', () => {
  const { normalizeRouteInput } = require('./routeModel');

  assert.deepEqual(
    normalizeRouteInput({
      name: ' 第一天 ',
      color: '#e65a46',
      place_ids: ['1', 2],
      order_index: '3',
      version: '4'
    }),
    {
      name: '第一天',
      color: '#E65A46',
      placeIds: [1, 2],
      orderIndex: 3,
      version: 4
    }
  );
});

test('route fields reject invalid boundaries', () => {
  const { normalizeRouteInput, validatePlaceIds } = require('./routeModel');

  assert.throws(() => normalizeRouteInput({
    name: '路'.repeat(121),
    color: '#E65A46',
    place_ids: [1, 2]
  }), /最多 120 字/);
  assert.throws(() => normalizeRouteInput({
    name: '第一天',
    color: 'red',
    place_ids: [1, 2]
  }), /颜色/);
  assert.throws(() => validatePlaceIds([1]), /至少需要两个地点/);
  assert.throws(() => validatePlaceIds([1, 0]), /路线地点无效/);
});

test('legacy ordered segments are combined into one ordered place sequence', () => {
  const { buildLegacyPlaceSequence } = require('./routeModel');

  assert.deepEqual(
    buildLegacyPlaceSequence([
      { id: 7, start_place_id: 1, end_place_id: 2 },
      { id: 8, start_place_id: 2, end_place_id: 3 },
      { id: 9, start_place_id: 3, end_place_id: 2 }
    ]),
    [1, 2, 3, 2]
  );
});

test('legacy conversion reports the two segments at a disconnected boundary', () => {
  const { buildLegacyPlaceSequence } = require('./routeModel');

  assert.throws(
    () => buildLegacyPlaceSequence([
      { id: 8, start_place_id: 1, end_place_id: 2 },
      { id: 9, start_place_id: 4, end_place_id: 5 }
    ]),
    /8.*9|9.*8/
  );
});

test('legacy conversion validates the resulting place sequence', () => {
  const { buildLegacyPlaceSequence } = require('./routeModel');

  assert.throws(
    () => buildLegacyPlaceSequence([
      { id: 8, from_place_id: 0, to_place_id: 2 }
    ]),
    /路线地点无效/
  );
});

test('adjacent duplicate stops collapse after place deletion', () => {
  const { collapseAdjacentPlaceIds } = require('./routeModel');

  assert.deepEqual(collapseAdjacentPlaceIds([1, 1, 2, 2, 1]), [1, 2, 1]);
  assert.deepEqual(collapseAdjacentPlaceIds([]), []);
});
