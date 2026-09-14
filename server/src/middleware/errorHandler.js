const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  // Log the error
  logger.error(err.message, {
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // Default error status and message
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Specific error handling
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation Error: ' + err.message;
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid ID format';
  } else if (err.code === 'SQLITE_CONSTRAINT') {
    status = 409;
    message = 'Constraint violation: ' + err.message;
  } else if (err.code === 'ENOENT') {
    status = 404;
    message = 'Not found';
  } else if (err.code === 'ECONNREFUSED') {
    status = 503;
    message = 'Service unavailable';
  } else if (err.code === 'ETIMEDOUT') {
    status = 408;
    message = 'Request timeout';
  } else if (err.code === 'EADDRINUSE') {
    status = 500;
    message = 'Port sudah dipakai service lain';
  }

  // Message-based inference for domain errors (no explicit code)
  if (status === 500) {
    if (/already exists|sudah ada|duplicate|unik/i.test(message)) status = 409;
    else if (/not found|tidak ditemukan/i.test(message)) status = 404;
    else if (/required|wajib diisi|harus|invalid|tidak valid/i.test(message)) status = 400;
    else if (/terkunci|locked/i.test(message)) status = 423;
  }

  // Send error response
  res.status(status).json({
    error: {
      status,
      message,
      timestamp: new Date().toISOString()
    }
  });
};
