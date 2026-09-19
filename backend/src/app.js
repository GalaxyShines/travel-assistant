const express = require('express');
const cors = require('cors');
const { config } = require('./config');
const authRouter = require('./routes/auth');
const tripsRouter = require('./routes/trips');
const placesRouter = require('./routes/places');
const routesRouter = require('./routes/routes');
const authRequired = require('./middleware/authRequired');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.use(
  cors({
    origin: config.backend.corsOrigin === '*' ? true : config.backend.corsOrigin,
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, appName: config.appName });
});

app.get('/api/config/public', (req, res) => {
  res.json({
    data: {
      appName: config.appName,
      baiduMapAkConfigured: Boolean(config.baiduMap.ak)
    }
  });
});

app.use('/api', authRouter);

app.use('/api', authRequired);

app.get('/api/auth/session', (req, res) => {
  res.json({ data: { valid: true } });
});

app.use('/api', tripsRouter);
app.use('/api', placesRouter);
app.use('/api', routesRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
