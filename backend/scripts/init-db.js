const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { config } = require('../src/config');
const { buildLegacyPlaceSequence } = require('../src/utils/routeModel');

const DATA_MIGRATION = '20260925_multi_stop_routes_data';
const FINAL_MIGRATION = '20260925_multi_stop_routes';

function assertSafeDatabaseName(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error('Database name can only contain letters, numbers, and underscores.');
  }
}

async function tableExists(connection, databaseName, tableName) {
  const [rows] = await connection.execute(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [databaseName, tableName]
  );
  return rows.length > 0;
}

async function detectRouteSchema(connection, databaseName) {
  assertSafeDatabaseName(databaseName);
  const [columnRows] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'routes'`,
    [databaseName]
  );
  const columns = new Set(columnRows.map((row) => row.COLUMN_NAME));
  const routeStopsExists = await tableExists(connection, databaseName, 'route_stops');
  const schemaMigrationsExists = await tableExists(connection, databaseName, 'schema_migrations');
  let markers = new Set();

  if (schemaMigrationsExists) {
    const [markerRows] = await connection.query(
      `SELECT version FROM \`${databaseName}\`.\`schema_migrations\``
    );
    markers = new Set(markerRows.map((row) => row.version));
  }

  const hasLegacyColumns = ['from_place_id', 'to_place_id', 'travel_mode']
    .some((column) => columns.has(column));
  const hasV2Columns = ['name', 'color', 'version'].every((column) => columns.has(column));
  const migrationApplied = markers.has(FINAL_MIGRATION);
  const dataMarkerApplied = markers.has(DATA_MIGRATION);
  let kind = 'unknown';

  if (hasLegacyColumns) kind = 'legacy';
  else if (hasV2Columns && migrationApplied) kind = 'v2';
  else if (hasV2Columns) kind = 'v2-unmarked';

  return {
    kind,
    columns,
    routeStopsExists,
    schemaMigrationsExists,
    hasLegacyColumns,
    migrationApplied,
    dataMarkerApplied
  };
}

function groupLegacySegments(segments) {
  const groups = [];
  for (const segment of segments) {
    const tripId = Number(segment.trip_id);
    const last = groups[groups.length - 1];
    if (!last || last.tripId !== tripId) {
      groups.push({ tripId, rows: [segment] });
    } else {
      last.rows.push(segment);
    }
  }
  return groups;
}

async function loadMigrationGroups(connection, databaseName) {
  const [segments] = await connection.query(
    `SELECT id, trip_id, from_place_id, to_place_id, order_index
     FROM \`${databaseName}\`.\`routes\`
     ORDER BY trip_id, order_index, id`
  );
  const failures = [];
  const groups = groupLegacySegments(segments).map(({ tripId, rows }) => {
    try {
      return { tripId, rows, placeIds: buildLegacyPlaceSequence(rows) };
    } catch (error) {
      failures.push(`计划 ${tripId}: ${error.message}`);
      return null;
    }
  }).filter(Boolean);

  if (failures.length > 0) {
    throw new Error(`旧路线迁移预检失败：${failures.join('；')}`);
  }
  return groups;
}

async function ensureMigrationTables(connection, databaseName, state) {
  if (!state.schemaMigrationsExists) {
    await connection.query(
      `CREATE TABLE IF NOT EXISTS \`${databaseName}\`.\`schema_migrations\` (
         \`version\` VARCHAR(120) NOT NULL,
         \`applied_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (\`version\`)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  }
  if (!state.routeStopsExists) {
    await connection.query(
      `CREATE TABLE IF NOT EXISTS \`${databaseName}\`.\`route_stops\` (
         \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
         \`route_id\` INT UNSIGNED NOT NULL,
         \`place_id\` INT UNSIGNED NOT NULL,
         \`stop_index\` INT UNSIGNED NOT NULL,
         PRIMARY KEY (\`id\`),
         UNIQUE KEY \`uq_route_stops_position\` (\`route_id\`, \`stop_index\`),
         INDEX \`idx_route_stops_place\` (\`place_id\`),
         CONSTRAINT \`fk_route_stops_route\` FOREIGN KEY (\`route_id\`)
           REFERENCES \`${databaseName}\`.\`routes\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
         CONSTRAINT \`fk_route_stops_place\` FOREIGN KEY (\`place_id\`)
           REFERENCES \`${databaseName}\`.\`places\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  }
}

async function addRouteAggregateColumns(connection, databaseName, columns) {
  const clauses = [];
  if (!columns.has('name')) clauses.push('ADD COLUMN `name` VARCHAR(120) NULL AFTER `trip_id`');
  if (!columns.has('color')) clauses.push('ADD COLUMN `color` CHAR(7) NULL AFTER `name`');
  if (!columns.has('version')) clauses.push('ADD COLUMN `version` INT UNSIGNED NULL DEFAULT 1 AFTER `order_index`');
  if (clauses.length > 0) {
    await connection.query(`ALTER TABLE \`${databaseName}\`.\`routes\` ${clauses.join(', ')}`);
  }
}

async function recordMigration(connection, databaseName, version) {
  await connection.query(
    `INSERT INTO \`${databaseName}\`.\`schema_migrations\` (version)
     VALUES (?) ON DUPLICATE KEY UPDATE version = VALUES(version)`,
    [version]
  );
}

async function migrateLegacyData(connection, databaseName, groups) {
  await connection.beginTransaction();
  try {
    for (const group of groups) {
      const canonicalId = Number(group.rows[0].id);
      await connection.query(
        `UPDATE \`${databaseName}\`.\`routes\`
         SET name = ?, color = ?, version = ? WHERE id = ?`,
        ['计划路线', '#D97706', 1, canonicalId]
      );
      for (let index = 0; index < group.placeIds.length; index += 1) {
        await connection.query(
          `INSERT INTO \`${databaseName}\`.\`route_stops\` (route_id, place_id, stop_index)
           VALUES (?, ?, ?)`,
          [canonicalId, group.placeIds[index], index + 1]
        );
      }
      const obsoleteIds = group.rows.slice(1).map((row) => Number(row.id));
      if (obsoleteIds.length > 0) {
        await connection.query(
          `DELETE FROM \`${databaseName}\`.\`routes\` WHERE id IN (${obsoleteIds.map(() => '?').join(', ')})`,
          obsoleteIds
        );
      }
    }
    await recordMigration(connection, databaseName, DATA_MIGRATION);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function dropLegacyRouteColumns(connection, databaseName) {
  await connection.query(
    `ALTER TABLE \`${databaseName}\`.\`routes\`
       DROP FOREIGN KEY \`fk_routes_from_place\`,
       DROP FOREIGN KEY \`fk_routes_to_place\`,
       DROP INDEX \`uq_routes_trip_direction\`,
       DROP COLUMN \`from_place_id\`,
       DROP COLUMN \`to_place_id\`,
       DROP COLUMN \`travel_mode\`,
       MODIFY COLUMN \`name\` VARCHAR(120) NOT NULL,
       MODIFY COLUMN \`color\` CHAR(7) NOT NULL DEFAULT '#D97706',
       MODIFY COLUMN \`version\` INT UNSIGNED NOT NULL DEFAULT 1`
  );
}

async function migrateLegacyRoutes(connection, databaseName) {
  const state = await detectRouteSchema(connection, databaseName);
  if (state.migrationApplied || state.kind === 'v2') return;
  if (state.kind === 'v2-unmarked') {
    await ensureMigrationTables(connection, databaseName, state);
    await recordMigration(connection, databaseName, FINAL_MIGRATION);
    return;
  }
  if (state.kind !== 'legacy') {
    throw new Error('无法识别 routes 表结构，数据库迁移已停止。');
  }

  const migrationGroups = state.dataMarkerApplied
    ? []
    : await loadMigrationGroups(connection, databaseName);

  await ensureMigrationTables(connection, databaseName, state);
  await addRouteAggregateColumns(connection, databaseName, state.columns);
  if (!state.dataMarkerApplied) {
    await migrateLegacyData(connection, databaseName, migrationGroups);
  }
  if (state.hasLegacyColumns) {
    await dropLegacyRouteColumns(connection, databaseName);
  }
  await recordMigration(connection, databaseName, FINAL_MIGRATION);
}

async function ensurePlaceSubtitleColumn(connection, databaseName) {
  const [columns] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'places' AND COLUMN_NAME = 'subtitle'`,
    [databaseName]
  );
  if (columns.length === 0) {
    await connection.query(
      `ALTER TABLE \`${databaseName}\`.\`places\`
       ADD COLUMN \`subtitle\` VARCHAR(15) NULL AFTER \`name\``
    );
  }
}

async function main() {
  assertSafeDatabaseName(config.database.name);
  const schemaPath = path.resolve(__dirname, '..', 'database', 'schema.sql');
  const schemaSql = fs
    .readFileSync(schemaPath, 'utf8')
    .replace(/`travel_helper`/g, `\`${config.database.name}\``);
  const connection = await mysql.createConnection({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    multipleStatements: true
  });

  try {
    await connection.query(schemaSql);
    await ensurePlaceSubtitleColumn(connection, config.database.name);
    await migrateLegacyRoutes(connection, config.database.name);
    console.log(`Database "${config.database.name}" is ready.`);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to initialize database.');
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  detectRouteSchema,
  migrateLegacyRoutes
};
