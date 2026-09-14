const database = require('../services/database.service');
const whatsappService = require('../services/whatsapp.service');
const logger = require('../utils/logger');

class AttendanceController {
  async getAttendance(req, res, next) {
    try {
      const { date, userId, status, limit = 100, offset = 0 } = req.query;
      
      const filters = {
        date,
        userId,
        status,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
      
      const result = database.getAttendance(filters);
      
      res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          limit: filters.limit,
          offset: filters.offset,
          hasMore: result.total > (filters.offset + filters.limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getAttendanceById(req, res, next) {
    try {
      const { id } = req.params;
      
      const result = database.getAttendance({ limit: 1, offset: 0 });
      const attendance = result.data.find(a => a.id == id);
      
      if (!attendance) {
        return res.status(404).json({
          success: false,
          error: 'Attendance record not found'
        });
      }
      
      res.json({
        success: true,
        data: attendance
      });
    } catch (error) {
      next(error);
    }
  }

  async getAttendanceByDate(req, res, next) {
    try {
      const { date } = req.params;
      
      const result = database.getAttendance({ date });
      
      res.json({
        success: true,
        date,
        count: result.total,
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  }

  async getAttendanceStats(req, res, next) {
    try {
      const { date } = req.query;
      
      const stats = database.getAttendanceStats(date);
      
      res.json({
        success: true,
        date: date || 'today',
        stats
      });
    } catch (error) {
      next(error);
    }
  }

  // Send / resend the WhatsApp message for an attendance record.
  async resendAttendance(req, res, next) {
    try {
      const { id } = req.params;
      
      const record = database.getAttendanceById(id);
      
      if (!record) {
        return res.status(404).json({
          success: false,
          error: `Attendance record ${id} not found`
        });
      }
      
      if (!record.whatsapp_number) {
        return res.status(400).json({
          success: false,
          error: 'Record has no WhatsApp number'
        });
      }
      
      logger.info(`Manual send requested for attendance #${id}`, {
        transactionId: record.transaction_id,
        user: record.user_name
      });
      
      const result = await whatsappService.sendAttendanceMessage(record);
      
      if (result.success) {
        database.markAsSent(record.transaction_id);
        logger.info(`Manual send OK for #${id}`, { messageId: result.messageId });
        
        return res.json({
          success: true,
          data: {
            id: Number(id),
            transactionId: record.transaction_id,
            status: 'sent',
            messageId: result.messageId
          }
        });
      }
      
      const failReason =
        (typeof result.error === 'string' && result.error ? result.error : '') ||
        result.message ||
        'Unknown error';
      database.markAsFailed(record.transaction_id, failReason);
      
      res.status(502).json({
        success: false,
        error: result.error || 'Failed to send message',
        data: { id: Number(id), transactionId: record.transaction_id, status: 'failed' }
      });
    } catch (error) {
      next(error);
    }
  }

  async createManualAttendance(req, res, next) {
    try {
      const { userId, mode, timestamp } = req.body;
      
      if (!userId || !mode) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: userId, mode'
        });
      }
      
      const user = database.getUser(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: `User with UID ${userId} not found`
        });
      }
      
      const helpers = require('../utils/helpers');
      const attendanceTime = timestamp ? new Date(timestamp) : new Date();
      const transactionId = helpers.getTransactionId(userId, attendanceTime);
      
      const attendanceData = {
        transaction_id: transactionId,
        user_id: user.uid,
        user_name: user.name,
        whatsapp_number: user.whatsapp_number,
        attendance_time: attendanceTime.toISOString(),
        mode,
        status: 'sent'
      };
      
      const result = database.createAttendance(attendanceData);
      
      logger.info('Manual attendance created', {
        userId,
        mode,
        transactionId
      });
      
      res.status(201).json({
        success: true,
        data: {
          id: result.id,
          transactionId
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AttendanceController();
