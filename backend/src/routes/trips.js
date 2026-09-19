const express = require('express');
const { pool } = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { nullableText, requiredText } = require('../utils/normalizers');

const router = express.Router();

// GET /api/trips - 查询所有旅行计划。
router.get(
  '/trips',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT id, name, description, created_at, updated_at
       FROM trips
       ORDER BY updated_at DESC, id DESC`
    );

    res.json({ data: rows });
  })
);

// POST /api/trips - 创建旅行计划。
router.post(
  '/trips',
  asyncHandler(async (req, res) => {
    const name = requiredText(req.body.name, '旅行计划名称');
    const description = nullableText(req.body.description);

    const [result] = await pool.execute(
      'INSERT INTO trips (name, description) VALUES (?, ?)',
      [name, description]
    );

    const [rows] = await pool.execute(
      `SELECT id, name, description, created_at, updated_at
       FROM trips
       WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({ data: rows[0] });
  })
);

// PUT /api/trips/:id - 修改旅行计划名称和描述。
router.put(
  '/trips/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const name = requiredText(req.body.name, '旅行计划名称');
    const description = nullableText(req.body.description);

    const [result] = await pool.execute(
      `UPDATE trips
       SET name = ?, description = ?
       WHERE id = ?`,
      [name, description, id]
    );

    if (result.affectedRows === 0) {
      throw httpError(404, '旅行计划不存在');
    }

    const [rows] = await pool.execute(
      `SELECT id, name, description, created_at, updated_at
       FROM trips
       WHERE id = ?`,
      [id]
    );

    res.json({ data: rows[0] });
  })
);

// DELETE /api/trips/:id - 删除旅行计划，外键会级联删除地点和路线。
router.delete(
  '/trips/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [result] = await pool.execute('DELETE FROM trips WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      throw httpError(404, '旅行计划不存在');
    }

    res.status(204).send();
  })
);

module.exports = router;
