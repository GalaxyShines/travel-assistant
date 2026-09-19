const express = require('express');
const { config } = require('../config');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { issueToken } = require('../utils/sessionStore');

const router = express.Router();

router.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const password = String(req.body?.password || '');

    if (password !== config.auth.password) {
      throw httpError(401, '授权口令错误');
    }

    const session = await issueToken();

    res.status(201).json({
      data: {
        token: session.token,
        token_type: 'Bearer',
        issued_at: session.issued_at
      }
    });
  })
);

module.exports = router;
