async function ensureUniqueRouteDirection(pool, httpError, tripId, fromPlaceId, toPlaceId, excludedRouteId = null) {
  const params = [tripId, fromPlaceId, toPlaceId];
  let sql = 'SELECT id FROM routes WHERE trip_id = ? AND from_place_id = ? AND to_place_id = ?';

  if (excludedRouteId !== null) {
    sql += ' AND id != ?';
    params.push(excludedRouteId);
  }

  const [rows] = await pool.execute(sql, params);
  if (rows.length > 0) {
    throw httpError(409, '路线已存在');
  }
}

function toRouteDuplicateError(error, httpError) {
  if (error?.code === 'ER_DUP_ENTRY') {
    return httpError(409, '路线已存在');
  }
  return error;
}

module.exports = { ensureUniqueRouteDirection, toRouteDuplicateError };
