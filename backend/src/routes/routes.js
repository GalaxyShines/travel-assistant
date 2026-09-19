const express = require('express');
const { pool } = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { integerOrDefault } = require('../utils/normalizers');
const { ensureUniqueRouteDirection, toRouteDuplicateError } = require('../utils/routeDirection');

const router = express.Router();
const ALLOWED_TRAVEL_MODES = new Set(['driving', 'walking', 'transit', 'riding']);

async function ensureTripExists(tripId) {
  const [rows] = await pool.execute('SELECT id FROM trips WHERE id = ?', [tripId]);
  if (rows.length === 0) {
    throw httpError(404, '旅行计划不存在');
  }
}

async function nextRouteOrder(tripId) {
  const [rows] = await pool.execute(
    'SELECT COALESCE(MAX(order_index) + 1, 0) AS next_order FROM routes WHERE trip_id = ?',
    [tripId]
  );
  return rows[0].next_order;
}

async function ensurePlacesBelongToTrip(tripId, fromPlaceId, toPlaceId) {
  if (fromPlaceId === toPlaceId) {
    throw httpError(400, '起点和终点不能相同');
  }

  const [rows] = await pool.execute(
    `SELECT id
     FROM places
     WHERE trip_id = ? AND id IN (?, ?)`,
    [tripId, fromPlaceId, toPlaceId]
  );

  if (rows.length !== 2) {
    throw httpError(400, '起点和终点必须都属于当前旅行计划');
  }
}

function normalizeTravelMode(value, defaultValue = 'driving') {
  const mode = value || defaultValue;
  if (!ALLOWED_TRAVEL_MODES.has(mode)) {
    throw httpError(400, 'travel_mode 只支持 driving / walking / transit / riding');
  }
  return mode;
}

const routeSelectSql = `
  SELECT
    r.id, r.trip_id, r.from_place_id, r.to_place_id, r.travel_mode,
    r.order_index, r.created_at, r.updated_at,
    fp.name AS from_place_name, fp.address AS from_place_address,
    fp.lng AS from_lng, fp.lat AS from_lat,
    tp.name AS to_place_name, tp.address AS to_place_address,
    tp.lng AS to_lng, tp.lat AS to_lat
  FROM routes r
  INNER JOIN places fp ON fp.id = r.from_place_id
  INNER JOIN places tp ON tp.id = r.to_place_id
`;

// GET /api/trips/:tripId/routes - 查询当前旅行计划下的路线连线。
router.get(
  '/trips/:tripId/routes',
  asyncHandler(async (req, res) => {
    const tripId = Number(req.params.tripId);
    await ensureTripExists(tripId);

    const [rows] = await pool.execute(
      `${routeSelectSql}
       WHERE r.trip_id = ?
       ORDER BY r.order_index ASC, r.id ASC`,
      [tripId]
    );

    res.json({ data: rows });
  })
);

// POST /api/trips/:tripId/routes - 创建同一旅行计划内两个地点之间的连线。
router.post(
  '/trips/:tripId/routes',
  asyncHandler(async (req, res) => {
    const tripId = Number(req.params.tripId);
    const fromPlaceId = Number(req.body.from_place_id);
    const toPlaceId = Number(req.body.to_place_id);
    const travelMode = normalizeTravelMode(req.body.travel_mode);

    await ensureTripExists(tripId);
    await ensurePlacesBelongToTrip(tripId, fromPlaceId, toPlaceId);
    await ensureUniqueRouteDirection(pool, httpError, tripId, fromPlaceId, toPlaceId);

    const orderIndex =
      req.body.order_index === undefined
        ? await nextRouteOrder(tripId)
        : integerOrDefault(req.body.order_index, 0);

    let result;
    try {
      [result] = await pool.execute(
        `INSERT INTO routes (trip_id, from_place_id, to_place_id, travel_mode, order_index)
         VALUES (?, ?, ?, ?, ?)`,
        [tripId, fromPlaceId, toPlaceId, travelMode, orderIndex]
      );
    } catch (error) {
      throw toRouteDuplicateError(error, httpError);
    }

    const [rows] = await pool.execute(`${routeSelectSql} WHERE r.id = ?`, [result.insertId]);
    res.status(201).json({ data: rows[0] });
  })
);

// PUT /api/routes/:id - 修改路线起止点、交通方式或排序。
router.put(
  '/routes/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [existingRows] = await pool.execute('SELECT * FROM routes WHERE id = ?', [id]);

    if (existingRows.length === 0) {
      throw httpError(404, '路线不存在');
    }

    const existing = existingRows[0];
    const fromPlaceId =
      req.body.from_place_id === undefined ? existing.from_place_id : Number(req.body.from_place_id);
    const toPlaceId =
      req.body.to_place_id === undefined ? existing.to_place_id : Number(req.body.to_place_id);
    const travelMode = normalizeTravelMode(req.body.travel_mode, existing.travel_mode);
    const orderIndex =
      req.body.order_index === undefined
        ? existing.order_index
        : integerOrDefault(req.body.order_index, existing.order_index);

    await ensurePlacesBelongToTrip(existing.trip_id, fromPlaceId, toPlaceId);
    await ensureUniqueRouteDirection(pool, httpError, existing.trip_id, fromPlaceId, toPlaceId, id);

    try {
      await pool.execute(
        `UPDATE routes
         SET from_place_id = ?, to_place_id = ?, travel_mode = ?, order_index = ?
         WHERE id = ?`,
        [fromPlaceId, toPlaceId, travelMode, orderIndex, id]
      );
    } catch (error) {
      throw toRouteDuplicateError(error, httpError);
    }

    const [rows] = await pool.execute(`${routeSelectSql} WHERE r.id = ?`, [id]);
    res.json({ data: rows[0] });
  })
);

// DELETE /api/routes/:id - 删除指定路线连线。
router.delete(
  '/routes/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [result] = await pool.execute('DELETE FROM routes WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      throw httpError(404, '路线不存在');
    }

    res.status(204).send();
  })
);

module.exports = router;
