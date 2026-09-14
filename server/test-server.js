const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const config = require('./src/config');
const logger = require('./src/utils/logger');

const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.env
  });
});

// Test database connection
app.get('/test-db', (req, res) => {
  try {
    const db = require('./src/services/database.service');
    
    // Get some stats
    const users = db.getUsers(5, 0);
    const attendance = db.getAttendance({ limit: 5, offset: 0 });
    
    res.json({
      success: true,
      database: {
        users: users.total,
        attendance: attendance.total,
        samples: {
          users: users.data.length,
          attendance: attendance.data.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test fingerprint service
app.get('/test-fingerprint', async (req, res) => {
  try {
    const fs = require('./src/services/fingerprint.service');
    const connected = await fs.checkConnection();
    
    res.json({
      success: connected,
      data: {
        connected,
        device: {
          ip: config.fingerprint.ip,
          port: config.fingerprint.port
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test WAHA service
app.get('/test-waha', async (req, res) => {
  try {
    const ws = require('./src/services/whatsapp.service');
    const status = await ws.checkStatus();
    
    res.json({
      success: status.connected,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Run database initialization
app.get('/init-db', async (req, res) => {
  try {
    const initDb = require('./scripts/init-db');
    await initDb();
    
    res.json({
      success: true,
      message: 'Database initialized successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PORT = config.port || 5001;

app.listen(PORT, () => {
  logger.info(`Test server running on http://localhost:${PORT}`);
  console.log(`🔬 Test server running on http://localhost:${PORT}`);
  console.log('\nAvailable endpoints:');
  console.log(`  GET  /health           - Health check`);
  console.log(`  GET  /test-db          - Test database connection`);
  console.log(`  GET  /test-fingerprint - Test fingerprint device`);
  console.log(`  GET  /test-waha        - Test WAHA connection`);
  console.log(`  GET  /init-db          - Initialize database`);
});
