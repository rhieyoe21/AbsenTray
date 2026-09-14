const database = require('../services/database.service');
const fingerprintService = require('../services/fingerprint.service');
const whatsappService = require('../services/whatsapp.service');
const schedulerService = require('../services/scheduler.service');

class DashboardController {
  async getStats(req, res, next) {
    try {
      const { date } = req.query;
      
      // Get attendance stats
      const stats = database.getAttendanceStats(date);
      
      // Get retry queue stats
      const pendingRetries = database.getPendingRetries();
      
      // Get device status
      const deviceStatus = fingerprintService.getStatus();
      const wahaStatus = whatsappService.getStatus();
      const schedulerStatus = schedulerService.getStatus();
      
      res.json({
        success: true,
        data: {
          attendance: stats,
          retryQueue: {
            pending: pendingRetries.length
          },
          device: deviceStatus,
          waha: wahaStatus,
          scheduler: schedulerStatus
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getRecentActivities(req, res, next) {
    try {
      const { limit = 20 } = req.query;
      
      const result = database.getAttendance({
        limit: parseInt(limit),
        offset: 0
      });
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  }

  async getChartData(req, res, next) {
    try {
      const { date } = req.query;
      
      const stats = database.getAttendanceStats(date);
      
      // Format for Chart.js
      const chartData = {
        hourly: {
          labels: stats.hourly.map(h => `${h.hour}:00`),
          datasets: [{
            label: 'Attendance Count',
            data: stats.hourly.map(h => h.count)
          }]
        },
        byMode: {
          labels: stats.byMode.map(m => m.mode),
          datasets: [{
            label: 'Count by Mode',
            data: stats.byMode.map(m => m.count)
          }]
        },
        byStatus: {
          labels: stats.byStatus.map(s => s.status),
          datasets: [{
            label: 'Count by Status',
            data: stats.byStatus.map(s => s.count)
          }]
        }
      };
      
      res.json({
        success: true,
        data: chartData
      });
    } catch (error) {
      next(error);
    }
  }

  async getDeviceStatus(req, res, next) {
    try {
      const deviceStatus = fingerprintService.getStatus();
      const deviceLogs = database.getDeviceLogs(50);
      
      res.json({
        success: true,
        data: {
          status: deviceStatus,
          recentLogs: deviceLogs
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getRetryQueueStatus(req, res, next) {
    try {
      const pendingRetries = database.getPendingRetries();
      
      res.json({
        success: true,
        data: {
          pending: pendingRetries.length,
          items: pendingRetries
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DashboardController();
