const express = require('express');
const { pool } = require('../db');
const { createRouteService } = require('../services/routeService');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
const routeService = createRouteService(pool);

router.get(
  '/trips/:tripId/routes',
  asyncHandler(async (req, res) => {
    const routes = await routeService.list(Number(req.params.tripId));
    res.json({ data: routes });
  })
);

router.post(
  '/trips/:tripId/routes',
  asyncHandler(async (req, res) => {
    const route = await routeService.create(Number(req.params.tripId), req.body);
    res.status(201).json({ data: route });
  })
);

router.put(
  '/routes/:id',
  asyncHandler(async (req, res) => {
    const route = await routeService.update(Number(req.params.id), req.body);
    res.json({ data: route });
  })
);

router.delete(
  '/routes/:id',
  asyncHandler(async (req, res) => {
    await routeService.remove(Number(req.params.id));
    res.status(204).send();
  })
);

module.exports = router;
