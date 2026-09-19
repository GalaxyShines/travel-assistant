const assert = require('node:assert/strict');
const test = require('node:test');
const { ensureUniqueRouteDirection } = require('./routeDirection');
const httpError = require('./httpError');

test('duplicate directed route is rejected with a conflict response', async () => {
  const pool = {
    async execute() {
      return [[{ id: 18 }]];
    }
  };

  await assert.rejects(
    ensureUniqueRouteDirection(pool, httpError, 4, 2, 3),
    (error) => error.statusCode === 409 && error.message === '路线已存在'
  );
});

test('editing a route excludes the route being edited from the duplicate query', async () => {
  let received = null;
  const pool = {
    async execute(sql, params) {
      received = { sql, params };
      return [[]];
    }
  };

  await ensureUniqueRouteDirection(pool, httpError, 4, 2, 3, 18);

  assert.match(received.sql, /AND id != \?/);
  assert.deepEqual(received.params, [4, 2, 3, 18]);
});
