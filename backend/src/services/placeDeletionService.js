const httpError = require('../utils/httpError');
const { collapseAdjacentPlaceIds } = require('../utils/routeModel');
const { withTransaction } = require('../utils/dbTransaction');

function groupAffectedRows(rows) {
  const routes = [];
  const byId = new Map();
  for (const row of rows) {
    const routeId = Number(row.route_id);
    let route = byId.get(routeId);
    if (!route) {
      route = { id: routeId, name: row.route_name, placeIds: [] };
      byId.set(routeId, route);
      routes.push(route);
    }
    route.placeIds.push(Number(row.place_id));
  }
  return routes;
}

function impactForRoute(route, placeId) {
  const occurrenceIndexes = route.placeIds.flatMap((id, index) => (
    id === placeId ? [index + 1] : []
  ));
  const remainingPlaceIds = collapseAdjacentPlaceIds(
    route.placeIds.filter((id) => id !== placeId)
  );
  const relink = remainingPlaceIds.length >= 2;
  return {
    routeId: route.id,
    name: route.name,
    occurrenceIndexes,
    outcome: relink ? 'relink' : 'delete-route',
    reason: relink ? null : route.placeIds.length === 2
      ? 'only-two-stops'
      : 'normalization-underflow',
    remainingPlaceIds,
    remainingStopCount: remainingPlaceIds.length
  };
}

function publicImpact(item) {
  const { remainingPlaceIds, ...visible } = item;
  return visible;
}

async function ensurePlaceExists(connection, placeId, lock = false) {
  const [rows] = await connection.execute(
    `SELECT id FROM places WHERE id = ?${lock ? ' FOR UPDATE' : ''}`,
    [placeId]
  );
  if (rows.length === 0) throw httpError(404, '地点不存在');
}

async function loadAffectedRoutes(connection, placeId, routeIds = null) {
  if (routeIds && routeIds.length === 0) return [];
  const routeFilter = routeIds
    ? `AND r.id IN (${routeIds.map(() => '?').join(', ')})`
    : '';
  const [rows] = await connection.execute(
    `SELECT r.id AS route_id, r.name AS route_name, rs.place_id, rs.stop_index
     FROM routes r
     INNER JOIN route_stops rs ON rs.route_id = r.id
     WHERE EXISTS (
       SELECT 1 FROM route_stops target
       WHERE target.route_id = r.id AND target.place_id = ?
     )
     ${routeFilter}
     ORDER BY r.order_index, r.id, rs.stop_index`,
    routeIds ? [placeId, ...routeIds] : [placeId]
  );
  return groupAffectedRows(rows);
}

async function calculateImpact(connection, placeId, routeIds = null) {
  const routes = await loadAffectedRoutes(connection, placeId, routeIds);
  return {
    placeId,
    routes: routes.map((route) => impactForRoute(route, placeId))
  };
}

async function lockAffectedRouteIds(connection, placeId) {
  const [rows] = await connection.execute(
    `SELECT r.id
     FROM routes r
     WHERE EXISTS (
       SELECT 1 FROM route_stops target
       WHERE target.route_id = r.id AND target.place_id = ?
     )
     ORDER BY r.id
     FOR UPDATE`,
    [placeId]
  );
  return rows.map((row) => Number(row.id));
}

async function insertStops(connection, routeId, placeIds) {
  for (let index = 0; index < placeIds.length; index += 1) {
    await connection.execute(
      'INSERT INTO route_stops (route_id, place_id, stop_index) VALUES (?, ?, ?)',
      [routeId, placeIds[index], index + 1]
    );
  }
}

function createPlaceDeletionService(pool) {
  return {
    async getImpact(placeId) {
      const numericPlaceId = Number(placeId);
      await ensurePlaceExists(pool, numericPlaceId);
      const impact = await calculateImpact(pool, numericPlaceId);
      return {
        placeId: impact.placeId,
        routes: impact.routes.map(publicImpact)
      };
    },

    async remove(placeId, { force = false } = {}) {
      return withTransaction(pool, async (connection) => {
        const numericPlaceId = Number(placeId);
        await ensurePlaceExists(connection, numericPlaceId, true);
        const routeIds = await lockAffectedRouteIds(connection, numericPlaceId);
        const impact = await calculateImpact(connection, numericPlaceId, routeIds);
        if (!force && impact.routes.length > 0) {
          throw httpError(409, '该地点正在被路线使用', {
            type: 'PLACE_IN_ROUTES',
            routes: impact.routes.map(publicImpact)
          });
        }

        const relinkedRoutes = [];
        const deletedRoutes = [];
        for (const item of impact.routes) {
          if (item.outcome === 'delete-route') {
            await connection.execute('DELETE FROM routes WHERE id = ?', [item.routeId]);
            deletedRoutes.push(item);
          } else {
            await connection.execute(
              'UPDATE routes SET version = version + 1 WHERE id = ?',
              [item.routeId]
            );
            await connection.execute('DELETE FROM route_stops WHERE route_id = ?', [item.routeId]);
            await insertStops(connection, item.routeId, item.remainingPlaceIds);
            relinkedRoutes.push(item);
          }
        }
        await connection.execute('DELETE FROM places WHERE id = ?', [numericPlaceId]);
        return { deletedPlaceId: numericPlaceId, relinkedRoutes, deletedRoutes };
      });
    }
  };
}

module.exports = {
  createPlaceDeletionService,
  impactForRoute
};
