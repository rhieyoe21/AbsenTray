const logger = require('../utils/logger');

module.exports = (io) => {
  io.on('connection', (socket) => {
    logger.info('Client connected', { socketId: socket.id });

    // Client events
    socket.on('disconnect', () => {
      logger.info('Client disconnected', { socketId: socket.id });
    });

    socket.on('error', (error) => {
      logger.error('Socket error', { socketId: socket.id, error: error.message });
    });

    // Heartbeat
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  // Namespace for attendance events
  const attendanceNamespace = io.of('/attendance');
  
  attendanceNamespace.on('connection', (socket) => {
    logger.debug('Attendance namespace connected', { socketId: socket.id });
    
    socket.on('disconnect', () => {
      logger.debug('Attendance namespace disconnected', { socketId: socket.id });
    });
  });

  return io;
};
