const assert = require('node:assert/strict');
const test = require('node:test');

function joinedRows() {
  return [
    {
      id: 9, trip_id: 5, name: '第一天', color: '#E65A46', order_index: 0, version: 1,
      stop_id: 31, place_id: 3, stop_index: 1, place_name: 'A', lng: '106.1', lat: '29.1'
    },
    {
      id: 9, trip_id: 5, name: '第一天', color: '#E65A46', order_index: 0, version: 1,
      stop_id: 32, place_id: 4, stop_index: 2, place_name: 'B', lng: '106.2', lat: '29.2'
    }
  ];
}

test('list groups flat joined rows into route aggregates with ordered stops', async () => {
  const { createRouteService } = require('../src/services/routeService');
  const pool = {
    async execute(sql) {
      if (/SELECT id FROM trips/.test(sql)) return [[{ id: 5 }]];
      if (/FROM routes r/.test(sql)) return [joinedRows()];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const service = createRouteService(pool);
  assert.deepEqual(await service.list(5), [{
    id: 9,
    trip_id: 5,
    name: '第一天',
    color: '#E65A46',
    order_index: 0,
    version: 1,
    stops: [
      { id: 31, place_id: 3, stop_index: 1, name: 'A', lng: 106.1, lat: 29.1 },
      { id: 32, place_id: 4, stop_index: 2, name: 'B', lng: 106.2, lat: 29.2 }
    ]
  }]);
});

test('create stores every stop occurrence including repeated place IDs', async () => {
  const { createRouteService } = require('../src/services/routeService');
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push({ sql: 'BEGIN', params: [] }); },
    async commit() { calls.push({ sql: 'COMMIT', params: [] }); },
    async rollback() { calls.push({ sql: 'ROLLBACK', params: [] }); },
    release() { calls.push({ sql: 'RELEASE', params: [] }); },
    async execute(sql, params = []) {
      calls.push({ sql, params });
      if (/SELECT id FROM trips/.test(sql)) return [[{ id: 5 }]];
      if (/MAX\(order_index\)/.test(sql)) return [[{ next_order: 2 }]];
      if (/SELECT id FROM places/.test(sql)) return [[{ id: 1 }, { id: 2 }]];
      if (/INSERT INTO routes/.test(sql)) return [{ insertId: 9, affectedRows: 1 }];
      if (/INSERT INTO route_stops/.test(sql)) return [{ insertId: 30, affectedRows: 1 }];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  const pool = {
    async getConnection() { return connection; },
    async execute(sql) {
      if (/FROM routes r/.test(sql)) return [joinedRows()];
      throw new Error(`Unexpected pool SQL: ${sql}`);
    }
  };

  await createRouteService(pool).create(5, {
    name: '第一天',
    color: '#e65a46',
    place_ids: [1, 2, 1]
  });

  const stopCalls = calls.filter(({ sql }) => /INSERT INTO route_stops/.test(sql));
  assert.deepEqual(stopCalls.map(({ params }) => params), [
    [9, 1, 1],
    [9, 2, 2],
    [9, 1, 3]
  ]);
  const routeInsert = calls.find(({ sql }) => /INSERT INTO routes/.test(sql));
  assert.deepEqual(routeInsert.params, [5, '第一天', '#E65A46', 2, 1]);
});

test('stale update rejects before deleting any saved stops', async () => {
  const { createRouteService } = require('../src/services/routeService');
  const calls = [];
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql, params = []) {
      calls.push({ sql, params });
      if (/SELECT .* FROM routes .*FOR UPDATE/s.test(sql)) {
        return [[{
          id: 9, trip_id: 5, name: '第一天', color: '#E65A46',
          order_index: 0, version: 4
        }]];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  const pool = { async getConnection() { return connection; } };

  await assert.rejects(
    () => createRouteService(pool).update(9, {
      name: '第一天',
      color: '#E65A46',
      place_ids: [1, 2],
      order_index: 0,
      version: 3
    }),
    (error) => error.statusCode === 409
  );
  assert.equal(calls.some(({ sql }) => /DELETE FROM route_stops/.test(sql)), false);
});
