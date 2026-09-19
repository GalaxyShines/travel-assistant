const app = require('./app');
const { config } = require('./config');
const { pingDatabase } = require('./db');

async function startServer() {
  await pingDatabase();

  app.listen(config.backend.port, () => {
    console.log(`Backend API is running at http://localhost:${config.backend.port}/api`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start backend API.');
  console.error(error);
  process.exit(1);
});
