const { verifyToken } = require('../utils/sessionStore');

function getBearerToken(req) {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme?.toLowerCase() !== 'bearer') {
    return null;
  }

  return token || null;
}

async function authRequired(req, res, next) {
  try {
    const token = getBearerToken(req);
    const isValid = await verifyToken(token);

    if (!isValid) {
      const error = new Error('登录已失效，请重新登录');
      error.statusCode = 401;
      throw error;
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authRequired;
