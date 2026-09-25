const assert = require('node:assert/strict');
const test = require('node:test');

function fakePool(events) {
  const connection = {
    async beginTransaction() { events.push('begin'); },
    async commit() { events.push('commit'); },
    async rollback() { events.push('rollback'); },
    release() { events.push('release'); }
  };

  return {
    connection,
    async getConnection() {
      events.push('connect');
      return connection;
    }
  };
}

test('transaction commits, releases, and returns the callback value', async () => {
  const { withTransaction } = require('./dbTransaction');
  const events = [];
  const pool = fakePool(events);

  const result = await withTransaction(pool, async (connection) => {
    assert.equal(connection, pool.connection);
    events.push('work');
    return { id: 42 };
  });

  assert.deepEqual(result, { id: 42 });
  assert.deepEqual(events, ['connect', 'begin', 'work', 'commit', 'release']);
});

test('transaction rolls back, releases, and rethrows the original error', async () => {
  const { withTransaction } = require('./dbTransaction');
  const events = [];
  const pool = fakePool(events);
  const originalError = new Error('write failed');

  await assert.rejects(
    withTransaction(pool, async () => {
      events.push('work');
      throw originalError;
    }),
    (error) => error === originalError
  );

  assert.deepEqual(events, ['connect', 'begin', 'work', 'rollback', 'release']);
});
