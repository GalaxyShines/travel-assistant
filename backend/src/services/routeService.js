const httpError = require('../utils/httpError');
const { normalizeRouteInput } = require('../utils/routeModel');
const { withTransaction } = require('../utils/dbTransaction');

const routeSelectSql = `
  SELECT r.id, r.trip_id, r.name, r.color, r.order_index, r.version,
         rs.id AS stop_id, rs.place_id, rs.stop_index,
         p.name AS place_name, p.address, p.lng, p.lat
  FROM routes r
  LEFT JOIN route_stops rs ON rs.route_id = r.id
  LEFT JOIN places p ON p.id = rs.place_id
`;

function toNumber(value) {
  return value === null || value === undefined ? value : Number(value);
}

function groupRouteRows(rows) {
  const routes = [];
  const byId = new Map();

  for (const row of rows) {
    let route = byId.get(Number(row.id));
    if (!route) {
      route = {
        id: Number(row.id),
        trip_id: Number(row.trip_id),
        name: row.name,
        color: row.color,
        order_index: Number(row.order_index),
        version: Number(row.version),
        stops: []
      };
      byId.set(route.id, route);
      routes.push(route);
    }

    if (row.stop_id !== null && row.stop_id !== undefined) {
      const stop = {
        id: Number(row.stop_id),
        place_id: Number(row.place_id),
        stop_index: Number(row.stop_index),
        name: row.place_name,
        lng: toNumber(row.lng),
        lat: toNumber(row.lat)
      };
      if (Object.prototype.hasOwnProperty.call(row, 'address')) {
        stop.address = row.address;
      }
      route.stops.push(stop);
    }
  }

  return routes;
}

async function ensureTripExists(connection, tripId) {
  const [rows] = await connection.execute('SELECT id FROM trips WHERE id = ?', [tripId]);
  if (rows.length === 0) throw httpError(404, '旅行计划不存在');
}

async function ensurePlacesBelongToTrip(connection, tripId, placeIds) {
  const requestedIds = [...new Set(placeIds)];
  const placeholders = requestedIds.map(() => '?').join(', ');
  const [rows] = await connection.execute(
    `SELECT id FROM places WHERE trip_id = ? AND id IN (${placeholders})`,
    [tripId, ...requestedIds]
  );
  const foundIds = new Set(rows.map((row) => Number(row.id)));
  if (requestedIds.some((id) => !foundIds.has(id))) {
    throw httpError(400, '路线中的地点必须都属于当前旅行计划');
  }
}

async function nextRouteOrder(connection, tripId) {
  const [rows] = await connection.execute(
    'SELECT COALESCE(MAX(order_index) + 1, 0) AS next_order FROM routes WHERE trip_id = ?',
    [tripId]
  );
  return Number(rows[0].next_order);
}

async function insertStops(connection, routeId, placeIds) {
  for (let index = 0; index < placeIds.length; index += 1) {
    await connection.execute(
      'INSERT INTO route_stops (route_id, place_id, stop_index) VALUES (?, ?, ?)',
      [routeId, placeIds[index], index + 1]
    );
  }
}

async function fetchRoute(connection, routeId) {
  const [rows] = await connection.execute(
    `${routeSelectSql}
     WHERE r.id = ?
     ORDER BY r.order_index, r.id, rs.stop_index`,
    [routeId]
  );
  return groupRouteRows(rows)[0] || null;
}

async function lockRoute(connection, routeId) {
  const [rows] = await connection.execute(
    `SELECT id, trip_id, name, color, order_index, version
     FROM routes WHERE id = ? FOR UPDATE`,
    [routeId]
  );
  if (rows.length === 0) throw httpError(404, '路线不存在');
  return rows[0];
}

function createRouteService(pool) {
  return {
    async list(tripId) {
      await ensureTripExists(pool, tripId);
      const [rows] = await pool.execute(
        `${routeSelectSql}
         WHERE r.trip_id = ?
         ORDER BY r.order_index, r.id, rs.stop_index`,
        [tripId]
      );
      return groupRouteRows(rows);
    },

    async create(tripId, body) {
      const routeId = await withTransaction(pool, async (connection) => {
        await ensureTripExists(connection, tripId);
        const defaultOrder = body.order_index === undefined
          ? await nextRouteOrder(connection, tripId)
          : 0;
        const payload = normalizeRouteInput(body, { orderIndex: defaultOrder });
        await ensurePlacesBelongToTrip(connection, tripId, payload.placeIds);
        const [result] = await connection.execute(
          `INSERT INTO routes (trip_id, name, color, order_index, version)
           VALUES (?, ?, ?, ?, ?)`,
          [tripId, payload.name, payload.color, payload.orderIndex, 1]
        );
        await insertStops(connection, result.insertId, payload.placeIds);
        return result.insertId;
      });
      return fetchRoute(pool, routeId);
    },

    async update(routeId, body) {
      const savedId = await withTransaction(pool, async (connection) => {
        const existing = await lockRoute(connection, routeId);
        if (body.version === undefined || body.version === null) {
          throw httpError(400, 'version 不能为空');
        }
        const payload = normalizeRouteInput(body, existing);
        if (Number(existing.version) !== payload.version) {
          throw httpError(409, '路线已被其他页面修改');
        }
        await ensurePlacesBelongToTrip(connection, Number(existing.trip_id), payload.placeIds);
        await connection.execute(
          `UPDATE routes
           SET name = ?, color = ?, order_index = ?, version = version + 1
           WHERE id = ?`,
          [payload.name, payload.color, payload.orderIndex, routeId]
        );
        await connection.execute('DELETE FROM route_stops WHERE route_id = ?', [routeId]);
        await insertStops(connection, routeId, payload.placeIds);
        return routeId;
      });
      return fetchRoute(pool, savedId);
    },

    async remove(routeId) {
      const [result] = await pool.execute('DELETE FROM routes WHERE id = ?', [routeId]);
      if (result.affectedRows === 0) throw httpError(404, '路线不存在');
    }
  };
}

module.exports = {
  createRouteService,
  groupRouteRows
};
