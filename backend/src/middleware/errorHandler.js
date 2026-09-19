function notFound(req, res, next) {
  const error = new Error(`接口不存在: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    message: error.message || '服务器内部错误',
    details: error.details
  });
}

module.exports = { errorHandler, notFound };
