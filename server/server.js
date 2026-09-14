const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const config = require('./src/config');
const routes = require('./src/routes');
const socketHandler = require('./src/sockets/socketHandler');
const logger = require('./src/utils/logger');
const errorHandler = require('./src/middleware/errorHandler');
const schedulerService = require('./src/services/scheduler.service');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: config.cors.origin,
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet()); // Security headers
app.use(compression()); // Gzip compression
app.use(cors({
  origin: config.cors.origin,
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // JSON body parsing
app.use(express.urlencoded({ extended: true })); // URL-encoded body parsing

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Routes
app.use('/api', routes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.env
  });
});

// Load persisted settings from database (overrides .env)
config.loadFromDatabase();
const database = require('./src/services/database.service');

// Socket.IO setup
socketHandler(io);

// Wire scheduler events to WebSocket broadcasts
schedulerService.on('attendance:new', (data) => {
  io.emit('attendance:new', data);
});
schedulerService.on('device:offline', (data) => {
  io.emit('device:offline', data);
});
schedulerService.on('device:recovered', (data) => {
  io.emit('device:recovered', data);
});
schedulerService.on('retry:sent', (data) => {
  io.emit('retry:sent', data);
});
schedulerService.on('retry:exhausted', (data) => {
  io.emit('retry:exhausted', data);
});

// Start scheduled jobs (polling, retry, health checks)
schedulerService.startAll();

// Apply persisted dashboard toggles (polling on/off, schedule mode)
const fingerprintService = require('./src/services/fingerprint.service');
if (database.getSetting('polling_enabled') === '0') {
  fingerprintService.setEnabled(false);
}
if (database.getSetting('schedule_enabled') === '1') {
  fingerprintService.setScheduleEnabled(true);
}

// Error handling (must come after routes and 404)
app.use('/api', errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.url}`
  });
});

// Start server
server.listen(config.port, config.host, () => {
  logger.info(`Server started on http://${config.host}:${config.port} in ${config.env} mode`);
  logger.info(`CORS enabled for: ${config.cors.origin}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };
