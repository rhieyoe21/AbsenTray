const dotenv = require('dotenv');
const path = require('path');

// override ensures .env values win even when the shell exposes an empty variable
dotenv.config({ path: path.join(__dirname, '../..', '.env'), override: true });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT) || 5000,
  host: process.env.HOST || '0.0.0.0',
  
  database: {
    path: process.env.DB_PATH || './data/attendance.db'
  },
  
  fingerprint: {
    ip: process.env.FINGERPRINT_IP || '192.168.1.102',
    port: parseInt(process.env.FINGERPRINT_PORT) || 4370,
    timeout: parseInt(process.env.FINGERPRINT_TIMEOUT) || 10000,
    pollingInterval: parseInt(process.env.POLLING_INTERVAL) || 30000
  },
  
  waha: {
    url: process.env.WAHA_URL || 'http://192.168.1.180:5555',
    apiKey: process.env.WAHA_API_KEY || '',
    session: process.env.WAHA_SESSION || 'default'
  },
  
  admin: {
    whatsapp: process.env.ADMIN_WHATSAPP || '628XXXXXXXXXX'
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log'
  },
  
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000'
  },
  
  retry: {
    maxAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3,
    delays: (process.env.RETRY_DELAYS || '60000,300000,900000').split(',').map(Number)
  }
};

// Load persisted settings from database (override env values at runtime).
// Called once during server startup. Also usable after DB-driven setting changes.
let dbLoader = null;
function loadFromDatabase() {
  try {
    if (!dbLoader) {
      const Database = require('better-sqlite3');
      dbLoader = new Database(config.database.path, { readonly: true, fileMustExist: false });
      dbLoader.pragma('journal_mode = WAL');
    }
    
    const row = (key) => {
      try {
        return dbLoader.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
      } catch (e) {
        return undefined;
      }
    };
    
    const ip = row('fingerprint_ip');
    const port = row('fingerprint_port');
    const timeout = row('fingerprint_timeout');
    const interval = row('polling_interval');
    const wahaUrl = row('waha_url');
    const wahaKey = row('waha_api_key');
    const wahaSession = row('waha_session');
    const adminWa = row('admin_whatsapp');
    const maxRetry = row('max_retry_attempts');
    const retryDelays = row('retry_delays');
    
    if (ip) config.fingerprint.ip = ip;
    if (port) config.fingerprint.port = parseInt(port);
    if (timeout) config.fingerprint.timeout = parseInt(timeout);
    if (interval) config.fingerprint.pollingInterval = parseInt(interval);
    if (wahaUrl) config.waha.url = wahaUrl;
    if (wahaKey) config.waha.apiKey = wahaKey;
    if (wahaSession) config.waha.session = wahaSession;
    if (adminWa) config.admin.whatsapp = adminWa;
    if (maxRetry) config.retry.maxAttempts = parseInt(maxRetry);
    if (retryDelays) config.retry.delays = retryDelays.split(',').map(Number);
    
    return true;
  } catch (error) {
    console.error('Failed to load settings from database:', error.message);
    return false;
  }
}

// Persist a runtime config change into the settings table.
function saveToDatabase(db) {
  const entries = [
    ['fingerprint_ip', config.fingerprint.ip],
    ['fingerprint_port', String(config.fingerprint.port)],
    ['fingerprint_timeout', String(config.fingerprint.timeout)],
    ['polling_interval', String(config.fingerprint.pollingInterval)],
    ['waha_url', config.waha.url],
    ['waha_api_key', config.waha.apiKey],
    ['waha_session', config.waha.session],
    ['admin_whatsapp', config.admin.whatsapp],
    ['max_retry_attempts', String(config.retry.maxAttempts)],
    ['retry_delays', config.retry.delays.join(',')]
  ];
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
  `);
  
  const insertAll = db.transaction((list) => {
    list.forEach(([k, v]) => stmt.run(k, String(v)));
  });
  
  insertAll(entries);
  return true;
}

module.exports = config;
module.exports.loadFromDatabase = loadFromDatabase;
module.exports.saveToDatabase = saveToDatabase;