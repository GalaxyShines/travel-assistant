const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');
const mysql = require('mysql2/promise');

const enabled = process.env.RUN_MYSQL_MIGRATION_TESTS === '1';
const integrationTest = enabled ? test : test.skip;
const projectConfig = require('../../app.config.json').database;
const migrationPath = path.resolve(__dirname, '..', 'database', 'migrate-multi-route-v2.sql');

function databaseName(label) {
  return `travel_helper_sql_${label}_${process.pid}_${Date.now()}`;
}

function connectionOptions(extra = {}) {
  return {
    host: projectConfig.host,
    port: Number(projectConfig.port || 3306),
    user: projectConfig.user,
    password: projectConfig.password,
    multipleStatements: true,
    ...extra
  };
}

async function createLegacyDatabase(name, { disconnected = false } = {}) {
  const admin = await mysql.createConnection(connectionOptions());
  await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();

  const connection = await mysql.createConnection(connectionOptions({ database: name }));
  await connection.query(`
    CREATE TABLE trips (
      id INT UNSIGNED NOT NULL,
      name VARCHAR(120) NOT NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB;
    CREATE TABLE places (
      id INT UNSIGNED NOT NULL,
      trip_id INT UNSIGNED NOT NULL,
      name VARCHAR(160) NOT NULL,
      lng DECIMAL(11,7) NOT NULL,
      lat DECIMAL(10,7) NOT NULL,
      PRIMARY KEY (id),
      CONSTRAINT fk_places_trip FOREIGN KEY (trip_id) REFERENCES trips (id)
    ) ENGINE=InnoDB;
    CREATE TABLE routes (
      id INT UNSIGNED NOT NULL,
      trip_id INT UNSIGNED NOT NULL,
      from_place_id INT UNSIGNED NOT NULL,
      to_place_id INT UNSIGNED NOT NULL,
      travel_mode ENUM('driving', 'walking', 'transit', 'riding') NOT NULL DEFAULT 'driving',
      order_index INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_routes_trip_direction (trip_id, from_place_id, to_place_id),
      KEY idx_routes_trip_order (trip_id, order_index, id),
      KEY idx_routes_from_place (from_place_id),
      KEY idx_routes_to_place (to_place_id),
      CONSTRAINT fk_routes_trip FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE,
      CONSTRAINT fk_routes_from_place FOREIGN KEY (from_place_id) REFERENCES places (id) ON DELETE CASCADE,
      CONSTRAINT fk_routes_to_place FOREIGN KEY (to_place_id) REFERENCES places (id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
    CREATE TABLE route_stops (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      route_id INT UNSIGNED NOT NULL,
      place_id INT UNSIGNED NOT NULL,
      stop_index INT UNSIGNED NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_route_stops_position (route_id, stop_index),
      KEY idx_route_stops_place (place_id),
      CONSTRAINT fk_route_stops_route FOREIGN KEY (route_id) REFERENCES routes (id) ON DELETE CASCADE,
      CONSTRAINT fk_route_stops_place FOREIGN KEY (place_id) REFERENCES places (id) ON DELETE RESTRICT
    ) ENGINE=InnoDB;
    CREATE TABLE schema_migrations (
      version VARCHAR(120) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (version)
    ) ENGINE=InnoDB;
    INSERT INTO trips (id, name) VALUES (1, '迁移验收计划');
    INSERT INTO places (id, trip_id, name, lng, lat) VALUES
      (101, 1, 'A', 106.5000000, 29.5000000),
      (102, 1, 'B', 106.5100000, 29.5100000),
      (103, 1, 'C', 106.5200000, 29.5200000),
      (104, 1, 'D', 106.5300000, 29.5300000);
  `);

  if (disconnected) {
    await connection.query(`
      INSERT INTO routes (id, trip_id, from_place_id, to_place_id, order_index) VALUES
        (301, 1, 101, 102, 0),
        (302, 1, 103, 102, 4),
        (303, 1, 102, 104, 7)
    `);
  } else {
    await connection.query(`
      INSERT INTO routes (id, trip_id, from_place_id, to_place_id, order_index) VALUES
        (201, 1, 101, 102, 0),
        (202, 1, 102, 103, 1),
        (203, 1, 103, 102, 2)
    `);
  }
  await connection.end();
}

async function dropDatabase(name) {
  const connection = await mysql.createConnection(connectionOptions());
  await connection.query(`DROP DATABASE IF EXISTS \`${name}\``);
  await connection.end();
}

async function runMigration(name) {
  const sql = await readFile(migrationPath, 'utf8');
  return new Promise((resolve, reject) => {
    const child = spawn('mysql', [
      `--host=${projectConfig.host}`,
      `--port=${Number(projectConfig.port || 3306)}`,
      `--user=${projectConfig.user}`,
      `--database=${name}`,
      '--default-character-set=utf8mb4'
    ], {
      env: { ...process.env, MYSQL_PWD: projectConfig.password },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(sql);
  });
}

integrationTest('SQL migration converts an ordered legacy route once and preserves a repeated stop', async () => {
  const name = databaseName('success');
  await createLegacyDatabase(name);
  try {
    const firstRun = await runMigration(name);
    assert.equal(firstRun.code, 0, firstRun.stderr);

    const connection = await mysql.createConnection(connectionOptions({ database: name }));
    const [routes] = await connection.query('SELECT id, name, color, version FROM routes ORDER BY id');
    const [stops] = await connection.query(
      'SELECT route_id, place_id, stop_index FROM route_stops ORDER BY route_id, stop_index'
    );
    const [oldColumns] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'routes'
        AND COLUMN_NAME IN ('from_place_id', 'to_place_id', 'travel_mode')
    `, [name]);
    const [markers] = await connection.query('SELECT version FROM schema_migrations ORDER BY version');
    await connection.end();

    assert.deepEqual(routes, [{ id: 201, name: '计划路线', color: '#D97706', version: 1 }]);
    assert.deepEqual(stops, [
      { route_id: 201, place_id: 101, stop_index: 1 },
      { route_id: 201, place_id: 102, stop_index: 2 },
      { route_id: 201, place_id: 103, stop_index: 3 },
      { route_id: 201, place_id: 102, stop_index: 4 }
    ]);
    assert.deepEqual(oldColumns, []);
    assert.deepEqual(markers.map((row) => row.version), [
      '20260925_multi_stop_routes',
      '20260925_multi_stop_routes_data'
    ]);

    const secondRun = await runMigration(name);
    assert.equal(secondRun.code, 0, secondRun.stderr);
    const verify = await mysql.createConnection(connectionOptions({ database: name }));
    const [[counts]] = await verify.query(
      'SELECT (SELECT COUNT(*) FROM routes) route_count, (SELECT COUNT(*) FROM route_stops) stop_count'
    );
    await verify.end();
    assert.deepEqual(counts, { route_count: 1, stop_count: 4 });
  } finally {
    await dropDatabase(name);
  }
});

integrationTest('SQL migration bridges disconnected segments in order and preserves the return stop', async () => {
  const name = databaseName('disconnected');
  await createLegacyDatabase(name, { disconnected: true });
  try {
    const result = await runMigration(name);
    assert.equal(result.code, 0, result.stderr);

    const connection = await mysql.createConnection(connectionOptions({ database: name }));
    const [routes] = await connection.query(
      'SELECT id, name, color, version FROM routes ORDER BY id'
    );
    const [stops] = await connection.query(
      'SELECT route_id, place_id, stop_index FROM route_stops ORDER BY route_id, stop_index'
    );
    await connection.end();

    assert.deepEqual(routes, [{ id: 301, name: '计划路线', color: '#D97706', version: 1 }]);
    assert.deepEqual(stops, [
      { route_id: 301, place_id: 101, stop_index: 1 },
      { route_id: 301, place_id: 102, stop_index: 2 },
      { route_id: 301, place_id: 103, stop_index: 3 },
      { route_id: 301, place_id: 102, stop_index: 4 },
      { route_id: 301, place_id: 104, stop_index: 5 }
    ]);
  } finally {
    await dropDatabase(name);
  }
});
