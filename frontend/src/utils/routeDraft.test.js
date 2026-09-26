import assert from 'node:assert/strict';
import { test } from 'node:test';

test('click order becomes one-based occurrence badges', async () => {
  const { appendStop, getOccurrenceNumbers } = await import('./routeDraft.js');
  let ids = [];
  ids = appendStop(ids, 10).placeIds;
  ids = appendStop(ids, 20).placeIds;
  ids = appendStop(ids, 30).placeIds;
  ids = appendStop(ids, 20).placeIds;

  assert.deepEqual(ids, [10, 20, 30, 20]);
  assert.deepEqual(getOccurrenceNumbers(ids, 20), [2, 4]);
});

test('the same place cannot be appended twice in a row', async () => {
  const { appendStop } = await import('./routeDraft.js');

  assert.deepEqual(appendStop([10], 10), {
    placeIds: [10],
    changed: false,
    mergedAdjacent: false,
    error: 'adjacent-duplicate'
  });
});

test('deleting B from A-B-A merges the adjacent A values', async () => {
  const { removeStopAt } = await import('./routeDraft.js');

  assert.deepEqual(removeStopAt([1, 2, 1], 1), {
    placeIds: [1],
    changed: true,
    mergedAdjacent: true,
    error: null
  });
});

test('deleting every occurrence removes only the selected place', async () => {
  const { removeAllStops } = await import('./routeDraft.js');

  assert.deepEqual(removeAllStops([1, 2, 3, 2], 2), {
    placeIds: [1, 3],
    changed: true,
    mergedAdjacent: false,
    error: null
  });
});

test('a move that creates adjacent duplicates is rejected', async () => {
  const { moveStop } = await import('./routeDraft.js');

  assert.deepEqual(moveStop([1, 2, 3, 2], 3, 2), {
    placeIds: [1, 2, 3, 2],
    changed: false,
    mergedAdjacent: false,
    error: 'adjacent-duplicate'
  });
});

test('a valid move returns a reordered copy', async () => {
  const { moveStop } = await import('./routeDraft.js');

  assert.deepEqual(moveStop([1, 2, 3], 2, 1), {
    placeIds: [1, 3, 2],
    changed: true,
    mergedAdjacent: false,
    error: null
  });
});

test('undo returns a cloned previous snapshot without mutating history', async () => {
  const { undoStops } = await import('./routeDraft.js');
  const history = [[1], [1, 2]];

  const previous = undoStops(history);

  assert.deepEqual(previous, [1, 2]);
  assert.notEqual(previous, history[1]);
  assert.deepEqual(history, [[1], [1, 2]]);
});

test('a new route draft has stable defaults', async () => {
  const { createRouteDraft } = await import('./routeDraft.js');

  assert.deepEqual(createRouteDraft(3), {
    id: null,
    name: '',
    color: '#D97706',
    placeIds: [],
    orderIndex: 3,
    version: null
  });
});

test('a saved route becomes an editable draft with numeric stop ids', async () => {
  const { routeToDraft } = await import('./routeDraft.js');

  assert.deepEqual(routeToDraft({
    id: '7',
    name: '第一天',
    color: '#e65a46',
    order_index: '3',
    version: '4',
    stops: [{ place_id: '1' }, { place_id: 2 }, { place_id: '1' }]
  }), {
    id: 7,
    name: '第一天',
    color: '#E65A46',
    placeIds: [1, 2, 1],
    orderIndex: 3,
    version: 4
  });
});

test('route payload contains aggregate fields and server version', async () => {
  const { routeDraftPayload } = await import('./routeDraft.js');

  assert.deepEqual(routeDraftPayload({
    id: 7,
    name: '第一天',
    color: '#e65a46',
    placeIds: [1, 2, 1],
    orderIndex: 3,
    version: 4
  }), {
    name: '第一天',
    color: '#E65A46',
    place_ids: [1, 2, 1],
    order_index: 3,
    version: 4
  });
});

test('new route payload omits an absent version', async () => {
  const { routeDraftPayload } = await import('./routeDraft.js');

  assert.deepEqual(routeDraftPayload(createDraftFixture()), {
    name: '第二天',
    color: '#2563EB',
    place_ids: [3, 4],
    order_index: 1
  });
});

test('draft dirty state compares editable route fields against a stable snapshot', async () => {
  const {
    createRouteDraft,
    isRouteDraftDirty,
    routeDraftFingerprint
  } = await import('./routeDraft.js');
  const draft = createRouteDraft(2);
  const snapshot = routeDraftFingerprint(draft);

  assert.equal(isRouteDraftDirty(draft, snapshot), false);
  draft.placeIds = [1, 2];
  assert.equal(isRouteDraftDirty(draft, snapshot), true);
  draft.placeIds = [];
  draft.name = '第一天';
  assert.equal(isRouteDraftDirty(draft, snapshot), true);
});

function createDraftFixture() {
  return {
    id: null,
    name: '第二天',
    color: '#2563eb',
    placeIds: [3, 4],
    orderIndex: 1,
    version: null
  };
}
