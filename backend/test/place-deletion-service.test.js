const assert = require('node:assert/strict');
const test = require('node:test');

function impactPool(rows) {
  return {
    async execute(sql) {
      if (/SELECT id FROM places/.test(sql)) return [[{ id: 2 }]];
      if (/FROM routes r/.test(sql)) return [rows];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
}

test('impact identifies routes that relink and routes that become too short', async () => {
  const { createPlaceDeletionService } = require('../src/services/placeDeletionService');
  const service = createPlaceDeletionService(impactPool([
    { route_id: 7, route_name: '第一天', place_id: 1, stop_index: 1 },
    { route_id: 7, route_name: '第一天', place_id: 2, stop_index: 2 },
    { route_id: 7, route_name: '第一天', place_id: 3, stop_index: 3 },
    { route_id: 7, route_name: '第一天', place_id: 4, stop_index: 4 },
    { route_id: 8, route_name: '第二天', place_id: 1, stop_index: 1 },
    { route_id: 8, route_name: '第二天', place_id: 2, stop_index: 2 }
  ]));

  assert.deepEqual(await service.getImpact(2), {
    placeId: 2,
    routes: [
      {
        routeId: 7,
        name: '第一天',
        occurrenceIndexes: [2],
        outcome: 'relink',
        reason: null,
        remainingStopCount: 3
      },
      {
        routeId: 8,
        name: '第二天',
        occurrenceIndexes: [2],
        outcome: 'delete-route',
        reason: 'only-two-stops',
        remainingStopCount: 1
      }
    ]
  });
});

test('impact includes every occurrence index for a repeated place', async () => {
  const { createPlaceDeletionService } = require('../src/services/placeDeletionService');
  const service = createPlaceDeletionService(impactPool([
    { route_id: 9, route_name: '折返路线', place_id: 1, stop_index: 1 },
    { route_id: 9, route_name: '折返路线', place_id: 2, stop_index: 2 },
    { route_id: 9, route_name: '折返路线', place_id: 3, stop_index: 3 },
    { route_id: 9, route_name: '折返路线', place_id: 2, stop_index: 4 },
    { route_id: 9, route_name: '折返路线', place_id: 4, stop_index: 5 }
  ]));

  const impact = await service.getImpact(2);
  assert.deepEqual(impact.routes[0].occurrenceIndexes, [2, 4]);
  assert.equal(impact.routes[0].remainingStopCount, 3);
});

function forcedDeletePool({ failOnStopInsert = false } = {}) {
  const events = [];
  const calls = [];
  const affectedRows = [
    { route_id: 7, route_name: '第一天', place_id: 1, stop_index: 1 },
    { route_id: 7, route_name: '第一天', place_id: 2, stop_index: 2 },
    { route_id: 7, route_name: '第一天', place_id: 3, stop_index: 3 },
    { route_id: 7, route_name: '第一天', place_id: 4, stop_index: 4 },
    { route_id: 8, route_name: '第二天', place_id: 1, stop_index: 1 },
    { route_id: 8, route_name: '第二天', place_id: 2, stop_index: 2 },
    { route_id: 9, route_name: '折返路线', place_id: 1, stop_index: 1 },
    { route_id: 9, route_name: '折返路线', place_id: 2, stop_index: 2 },
    { route_id: 9, route_name: '折返路线', place_id: 1, stop_index: 3 }
  ];
  const connection = {
    events,
    calls,
    async beginTransaction() { events.push('begin'); },
    async commit() { events.push('commit'); },
    async rollback() { events.push('rollback'); },
    release() { events.push('release'); },
    async execute(sql, params = []) {
      calls.push({ sql, params });
      if (/SELECT id FROM places.*FOR UPDATE/s.test(sql)) return [[{ id: 2 }]];
      if (/SELECT r\.id.*FOR UPDATE/s.test(sql)) return [[{ id: 7 }, { id: 8 }, { id: 9 }]];
      if (/SELECT r\.id AS route_id/.test(sql)) return [affectedRows];
      if (/INSERT INTO route_stops/.test(sql) && failOnStopInsert) throw new Error('stop write failed');
      if (/^(DELETE|INSERT|UPDATE)/.test(sql.trim())) return [{ affectedRows: 1, insertId: 1 }];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  return {
    connection,
    pool: { async getConnection() { return connection; } }
  };
}

test('forced deletion relinks valid routes and deletes underflowed routes atomically', async () => {
  const { createPlaceDeletionService } = require('../src/services/placeDeletionService');
  const { pool, connection } = forcedDeletePool();

  const summary = await createPlaceDeletionService(pool).remove(2, { force: true });

  assert.deepEqual(summary.deletedRoutes.map((route) => route.routeId), [8, 9]);
  assert.deepEqual(summary.relinkedRoutes[0].remainingPlaceIds, [1, 3, 4]);
  const rewrittenStops = connection.calls
    .filter(({ sql }) => /INSERT INTO route_stops/.test(sql))
    .map(({ params }) => params);
  assert.deepEqual(rewrittenStops, [[7, 1, 1], [7, 3, 2], [7, 4, 3]]);
  assert.equal(
    connection.calls.some(({ sql, params }) => (
      /UPDATE routes SET version = version \+ 1 WHERE id = \?/.test(sql)
      && params[0] === 7
    )),
    true
  );
  assert.deepEqual(connection.events.slice(-2), ['commit', 'release']);
});

test('a forced-delete write failure rolls back before deleting the place', async () => {
  const { createPlaceDeletionService } = require('../src/services/placeDeletionService');
  const { pool, connection } = forcedDeletePool({ failOnStopInsert: true });

  await assert.rejects(
    createPlaceDeletionService(pool).remove(2, { force: true }),
    /stop write failed/
  );

  assert.equal(
    connection.calls.some(({ sql }) => /DELETE FROM places/.test(sql)),
    false
  );
  assert.deepEqual(connection.events.slice(-2), ['rollback', 'release']);
});

test('a referenced non-forced delete returns structured conflict details', async () => {
  const { createPlaceDeletionService } = require('../src/services/placeDeletionService');
  const { pool } = forcedDeletePool();

  await assert.rejects(
    createPlaceDeletionService(pool).remove(2),
    (error) => error.statusCode === 409
      && error.details.type === 'PLACE_IN_ROUTES'
      && error.details.routes.length === 3
  );
});
