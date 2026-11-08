const config = require('./config');
const { initDatabase } = require('./db/database');
const app = require('./app');

// 1. Validate configuration on startup
config.validateConfig();

// 2. Safe environment logging
config.logConfig();

// 3. Initialize database
initDatabase();

// 4. Bind server to configured HOST and PORT
const server = app.listen(config.PORT, config.HOST, () => {
  console.log(`Server listening on http://${config.HOST}:${config.PORT}`);
});

// Graceful shutdown handling for container/EC2 termination
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
