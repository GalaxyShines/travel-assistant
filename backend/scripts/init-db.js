const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { config } = require('../src/config');

function assertSafeDatabaseName(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error('Database name can only contain letters, numbers, and underscores.');
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
    await ensureRouteDirectionUniqueIndex(connection, config.database.name);
    console.log(`Database "${config.database.name}" is ready.`);
  } finally {
    await connection.end();
  }
}

async function ensurePlaceSubtitleColumn(connection, databaseName) {
  const [columns] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'places' AND COLUMN_NAME = 'subtitle'`,
    [databaseName]
  );

  if (columns.length > 0) {
    return;
  }

  await connection.query(
    `ALTER TABLE \`${databaseName}\`.\`places\`
     ADD COLUMN \`subtitle\` VARCHAR(15) NULL AFTER \`name\``
  );
}

async function ensureRouteDirectionUniqueIndex(connection, databaseName) {
  const [indexes] = await connection.execute(
    `SELECT INDEX_NAME
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'routes' AND INDEX_NAME = 'uq_routes_trip_direction'`,
    [databaseName]
  );

  if (indexes.length > 0) {
    return;
  }

  const [duplicates] = await connection.query(
    `SELECT trip_id, from_place_id, to_place_id, COUNT(*) AS count
     FROM \`${databaseName}\`.\`routes\`
     GROUP BY trip_id, from_place_id, to_place_id
     HAVING COUNT(*) > 1`
  );

  if (duplicates.length > 0) {
    throw new Error('发现重复路线，请先清理同一计划内起点和终点相同的路线后再初始化数据库。');
  }

  await connection.query(
    `ALTER TABLE \`${databaseName}\`.\`routes\`
     ADD UNIQUE KEY \`uq_routes_trip_direction\` (\`trip_id\`, \`from_place_id\`, \`to_place_id\`)`
  );
}

main().catch((error) => {
  console.error('Failed to initialize database.');
  console.error(error);
  process.exit(1);
});
