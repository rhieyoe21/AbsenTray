const fs = require('fs');
const path = require('path');
const config = require('../config');

// Ensure logs directory exists
const logsDir = path.dirname(config.logging.file);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const LEVEL_NAMES = {
  0: 'ERROR',
  1: 'WARN',
  2: 'INFO',
  3: 'DEBUG'
};

class Logger {
  constructor(logFile = config.logging.file, logLevel = config.logging.level) {
    this.logFile = logFile;
    this.logLevel = LOG_LEVELS[logLevel] || LOG_LEVELS.info;
  }

  formatTimestamp() {
    return new Date().toISOString();
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = this.formatTimestamp();
    const levelName = LEVEL_NAMES[level];
    const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
    
    return `[${timestamp}] [${levelName}] ${message} ${metaStr}`.trim();
  }

  log(level, message, meta = {}) {
    // Check if this level should be logged
    if (level > this.logLevel) {
      return;
    }

    const formatted = this.formatMessage(level, message, meta);

    // Console output
    const consoleMethod = level === 0 ? 'error' : level === 1 ? 'warn' : 'log';
    console[consoleMethod](formatted);

    // File output
    try {
      fs.appendFileSync(this.logFile, formatted + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  error(message, meta = {}) {
    this.log(LOG_LEVELS.error, message, meta);
  }

  warn(message, meta = {}) {
    this.log(LOG_LEVELS.warn, message, meta);
  }

  info(message, meta = {}) {
    this.log(LOG_LEVELS.info, message, meta);
  }

  debug(message, meta = {}) {
    this.log(LOG_LEVELS.debug, message, meta);
  }

  // Rotate log file if it exceeds max size (10MB)
  rotateIfNeeded(maxSize = 10 * 1024 * 1024) {
    try {
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size > maxSize) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const rotatedFile = `${this.logFile}.${timestamp}`;
          fs.renameSync(this.logFile, rotatedFile);
          this.info('Log file rotated', { from: this.logFile, to: rotatedFile });
        }
      }
    } catch (error) {
      console.error('Failed to rotate log file:', error.message);
    }
  }
}

// Create and export singleton instance
const logger = new Logger();

// Check and rotate on startup
logger.rotateIfNeeded();

// Rotate every 24 hours
setInterval(() => {
  logger.rotateIfNeeded();
}, 24 * 60 * 60 * 1000);

module.exports = logger;
