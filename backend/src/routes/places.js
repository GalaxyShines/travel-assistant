const express = require('express');
const { pool } = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const {
  integerOrDefault,
  nullableDateTime,
  nullableText,
  numberInRange,
  requiredText
} = require('../utils/normalizers');

const router = express.Router();

async function ensureTripExists(tripId) {
  const [rows] = await pool.execute('SELECT id FROM trips WHERE id = ?', [tripId]);
  if (rows.length === 0) {
    throw httpError(404, '旅行计划不存在');
  }
}

async function nextPlaceOrder(tripId) {
  const [rows] = await pool.execute(
    'SELECT COALESCE(MAX(order_index) + 1, 0) AS next_order FROM places WHERE trip_id = ?',
    [tripId]
  );
  return rows[0].next_order;
}

function nullableSubtitle(value, defaults) {
  if (value === undefined) {
    return defaults;
  }

  const subtitle = nullableText(value);
  if (subtitle && Array.from(subtitle).length > 15) {
    throw httpError(400, '地点小标题最多 15 字');
  }

  return subtitle;
}

function normalizePlacePayload(body, defaults = {}) {
  const hasDefault = (field) => Object.prototype.hasOwnProperty.call(defaults, field);

  return {
    name: body.name === undefined && hasDefault('name') ? defaults.name : requiredText(body.name, '地点名称'),
    subtitle: nullableSubtitle(body.subtitle, hasDefault('subtitle') ? defaults.subtitle : null),
    address: body.address === undefined ? (hasDefault('address') ? defaults.address : null) : nullableText(body.address),
    lng: body.lng === undefined && hasDefault('lng') ? Number(defaults.lng) : numberInRange(body.lng, '经度 lng', -180, 180),
    lat: body.lat === undefined && hasDefault('lat') ? Number(defaults.lat) : numberInRange(body.lat, '纬度 lat', -90, 90),
    note: body.note === undefined ? (hasDefault('note') ? defaults.note : null) : nullableText(body.note),
    visit_time:
      body.visit_time === undefined ? (hasDefault('visit_time') ? defaults.visit_time : null) : nullableDateTime(body.visit_time),
    todo: body.todo === undefined ? (hasDefault('todo') ? defaults.todo : null) : nullableText(body.todo),
    order_index:
      body.order_index === undefined
        ? Number(defaults.order_index || 0)
        : integerOrDefault(body.order_index, defaults.order_index || 0),
    baidu_uid: body.baidu_uid === undefined ? (hasDefault('baidu_uid') ? defaults.baidu_uid : null) : nullableText(body.baidu_uid)
  };
}

// GET /api/trips/:tripId/places - 查询当前旅行计划下的地点。
router.get(
  '/trips/:tripId/places',
  asyncHandler(async (req, res) => {
    const tripId = Number(req.params.tripId);
    await ensureTripExists(tripId);

    const [rows] = await pool.execute(
      `SELECT id, trip_id, name, subtitle, address, lng, lat, note, visit_time, todo,
              order_index, baidu_uid, created_at, updated_at
       FROM places
       WHERE trip_id = ?
       ORDER BY order_index ASC, id ASC`,
      [tripId]
    );

    res.json({ data: rows });
  })
);

// POST /api/trips/:tripId/places - 添加地图点击、搜索结果或手动录入的地点。
router.post(
  '/trips/:tripId/places',
  asyncHandler(async (req, res) => {
    const tripId = Number(req.params.tripId);
    await ensureTripExists(tripId);

    const payload = normalizePlacePayload(req.body, {
      order_index: await nextPlaceOrder(tripId)
    });

    const [result] = await pool.execute(
      `INSERT INTO places
        (trip_id, name, subtitle, address, lng, lat, note, visit_time, todo, order_index, baidu_uid)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tripId,
        payload.name,
        payload.subtitle,
        payload.address,
        payload.lng,
        payload.lat,
        payload.note,
        payload.visit_time,
        payload.todo,
        payload.order_index,
        payload.baidu_uid
      ]
    );

    const [rows] = await pool.execute('SELECT * FROM places WHERE id = ?', [result.insertId]);
    res.status(201).json({ data: rows[0] });
  })
);

// PUT /api/places/:id - 编辑地点名称、坐标、备注、计划时间、事项和排序。
router.put(
  '/places/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [existingRows] = await pool.execute('SELECT * FROM places WHERE id = ?', [id]);

    if (existingRows.length === 0) {
      throw httpError(404, '地点不存在');
    }

    const payload = normalizePlacePayload(req.body, existingRows[0]);

    await pool.execute(
      `UPDATE places
       SET name = ?, subtitle = ?, address = ?, lng = ?, lat = ?, note = ?, visit_time = ?,
           todo = ?, order_index = ?, baidu_uid = ?
       WHERE id = ?`,
      [
        payload.name,
        payload.subtitle,
        payload.address,
        payload.lng,
        payload.lat,
        payload.note,
        payload.visit_time,
        payload.todo,
        payload.order_index,
        payload.baidu_uid,
        id
      ]
    );

    const [rows] = await pool.execute('SELECT * FROM places WHERE id = ?', [id]);
    res.json({ data: rows[0] });
  })
);

// DELETE /api/places/:id - 删除地点，外键会级联删除相关路线。
router.delete(
  '/places/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [result] = await pool.execute('DELETE FROM places WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      throw httpError(404, '地点不存在');
    }

    res.status(204).send();
  })
);

module.exports = router;
