const assert = require('node:assert/strict');
const test = require('node:test');

const mysql = require('mysql2/promise');
const originalCreateConnection = mysql.createConnection;
let connectionAttempted = false;
mysql.createConnection = async () => {
  connectionAttempted = true;
  return new Promise(() => {});
};
const migration = require('../scripts/init-db');
mysql.createConnection = originalCreateConnection;

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim();
}

function fakeInformationSchema(options) {
  const routeColumns = options.routeColumns || [];
  const markers = new Set(options.markers || []);
  if (options.migrationApplied) markers.add('20260925_multi_stop_routes');

  return {
    writeStatements: [],
    transactionEvents: [],
    async execute(sql, params = []) {
      return this.query(sql, params);
    },
    async query(sql, params = []) {
      const normalized = normalizeSql(sql);

      if (/INFORMATION_SCHEMA\.COLUMNS/i.test(normalized)) {
        return [routeColumns.map((COLUMN_NAME) => ({ COLUMN_NAME }))];
      }
      if (/INFORMATION_SCHEMA\.TABLES/i.test(normalized)) {
        const tableName = params.at(-1);
        const exists = tableName === 'route_stops'
          ? options.routeStopsExists
          : tableName === 'schema_migrations'
            ? options.schemaMigrationsExists !== false
            : false;
        return [exists ? [{ TABLE_NAME: tableName }] : []];
      }
      if (/SELECT version FROM .*schema_migrations/i.test(normalized)) {
        return [[...markers].map((version) => ({ version }))];
      }
      if (/SELECT id, trip_id, from_place_id, to_place_id, order_index FROM .*routes/i.test(normalized)) {
        return [options.segments || []];
      }
      if (/^(INSERT|UPDATE|DELETE|ALTER)\b/i.test(normalized)) {
        this.writeStatements.push(normalized);
        if (/^INSERT INTO .*schema_migrations/i.test(normalized) && params[0]) {
          markers.add(params[0]);
        }
        return [{ affectedRows: 1, insertId: 1 }];
      }
      if (/^CREATE\b/i.test(normalized)) {
        return [{ affectedRows: 0 }];
      }

      throw new Error(`Unexpected SQL in migration test: ${normalized}`);
    },
    async beginTransaction() { this.transactionEvents.push('begin'); },
    async commit() { this.transactionEvents.push('commit'); },
    async rollback() { this.transactionEvents.push('rollback'); }
  };
}

test('requiring the initializer does not connect to the database', () => {
  assert.equal(connectionAttempted, false);
});

test('a fresh v2 schema is recognized without legacy work', async () => {
  const state = await migration.detectRouteSchema(fakeInformationSchema({
    routeColumns: ['id', 'trip_id', 'name', 'color', 'order_index', 'version'],
    routeStopsExists: true,
    migrationApplied: false
  }), 'travel_helper');

  assert.equal(state.kind, 'v2-unmarked');
});

test('legacy columns with existing route_stops are resumable', async () => {
  const state = await migration.detectRouteSchema(fakeInformationSchema({
    routeColumns: ['id', 'trip_id', 'from_place_id', 'to_place_id', 'travel_mode', 'order_index'],
    routeStopsExists: true,
    migrationApplied: false
  }), 'travel_helper');

  assert.equal(state.kind, 'legacy');
});

test('disconnected legacy data is rejected before destructive writes', async () => {
  const connection = fakeInformationSchema({
    routeColumns: ['id', 'trip_id', 'from_place_id', 'to_place_id', 'travel_mode', 'order_index'],
    routeStopsExists: true,
    segments: [
      { id: 8, trip_id: 3, from_place_id: 1, to_place_id: 2, order_index: 0 },
      { id: 9, trip_id: 3, from_place_id: 7, to_place_id: 8, order_index: 1 }
    ]
  });

  await assert.rejects(
    migration.migrateLegacyRoutes(connection, 'travel_helper'),
    /计划 3.*8.*9|计划 3.*9.*8/
  );
  assert.deepEqual(connection.writeStatements, []);
});

test('migration resumes after data phase with one final alter and marker write', async () => {
  const connection = fakeInformationSchema({
    routeColumns: [
      'id', 'trip_id', 'from_place_id', 'to_place_id', 'travel_mode',
      'name', 'color', 'order_index', 'version'
    ],
    routeStopsExists: true,
    markers: ['20260925_multi_stop_routes_data']
  });

  await migration.migrateLegacyRoutes(connection, 'travel_helper');

  assert.equal(
    connection.writeStatements.filter((sql) => /^ALTER TABLE/i.test(sql)).length,
    1
  );
  assert.equal(
    connection.writeStatements.filter((sql) => /^INSERT INTO .*schema_migrations/i.test(sql)).length,
    1
  );
});
