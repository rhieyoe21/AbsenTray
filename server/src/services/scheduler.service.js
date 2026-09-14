const cron = require('node-cron');
const moment = require('moment-timezone');
const config = require('../config');
const logger = require('../utils/logger');
const database = require('./database.service');
const fingerprintService = require('./fingerprint.service');
const whatsappService = require('./whatsapp.service');
const helpers = require('../utils/helpers');
const alertService = require('./alert.service');
const { EventEmitter } = require('events');

// per-minute clock helper (WIB)
const ZONE = 'Asia/Jakarta';

class SchedulerService extends EventEmitter {
  constructor() {
    super();
    this.jobs = [];
    this.lastDeviceCheck = null;
    this.lastRetryRun = null;
    this.isProcessing = false;
    this.missingUserWarned = new Set(); // UIDs already warned (avoid log spam)
  }

  startAll() {
    logger.info('Starting all scheduled jobs...');
    
    // Job 1: Fingerprint polling (every 30 seconds)
    this.startFingerprintPolling();
    
    // Job 2: Retry queue processor (every 1 minute)
    this.startRetryProcessor();
    
    // Job 3: Device health check (every 5 minutes)
    this.startDeviceHealthCheck();
    
    // Job 4: WAHA health check (every 5 minutes)
    this.startWahaHealthCheck();
    
    // Job 5: Daily maintenance (at 2 AM)
    this.startDailyMaintenance();
    
    // Job 6: Database backup (every Sunday at 3 AM)
    this.startDatabaseBackup();
    
    logger.info('All scheduled jobs started');
  }

  stopAll() {
    logger.info('Stopping all scheduled jobs...');
    
    this.jobs.forEach(job => {
      if (job.destroy) job.destroy();
    });
    this.jobs = [];
    
    fingerprintService.stopPolling();
    
    logger.info('All scheduled jobs stopped');
  }

  startFingerprintPolling() {
    logger.info('Starting fingerprint polling job');
    
    fingerprintService.on('device:offline', (data) => {
      logger.warn('Device offline detected', data);
      
      // Emit to WebSocket clients
      this.emit('device:offline', data);
      
      // Send alert to admin (handled by alert service)
      alertService.handleDeviceOffline(data);
    });
    
    fingerprintService.on('device:recovered', (ip) => {
      logger.info('Device recovered', { ip });
      
      // Emit to WebSocket clients
      this.emit('device:recovered', { ip });
      
      // Send recovery alert
      alertService.handleDeviceRecovery(ip);
    });
    
    // Start the actual polling
    fingerprintService.startPolling((record) => {
      this.processAttendanceRecord(record);
    });
  }

  async processAttendanceRecord(record) {
    try {
      const { userId, timestamp } = record;
      
      if (!userId) {
        logger.warn('Missing user ID in attendance record', record);
        return;
      }
      
      // Get user from database
      const user = database.getUser(userId.toString());
      
      if (!user) {
        // Warn only ONCE per UID to avoid flooding the log.
        if (!this.missingUserWarned.has(userId.toString())) {
          this.missingUserWarned.add(userId.toString());
          logger.warn(`User with UID ${userId} not found in database — record skipped`);
        }
        return;
      }
      
      // Determine mode (in/out) based on time
      const mode = this.determineMode(timestamp);
      
      // Build transaction ID
      const transactionId = helpers.getTransactionId(user.uid, timestamp);
      
      // Check if already processed — by exact transaction ID so old/back-dated
      // logs that already exist in the DB are skipped (no UNIQUE crash, no resend).
      if (database.getAttendanceByTransactionId(transactionId)) {
        logger.debug('Duplicate attendance record, skipping', { transactionId });
        return;
      }
      
      // Create attendance record in database
      const attendanceData = {
        transaction_id: transactionId,
        user_id: user.uid,
        user_name: user.name,
        whatsapp_number: user.whatsapp_number,
        attendance_time: timestamp,
        mode,
        status: 'pending'
      };
      
      database.createAttendance(attendanceData);
      
      // Auto-send WhatsApp ONLY for attendance that happened today (local time).
      // Historical/back-dated logs are stored but NOT auto-sent; they can be sent
      // manually from the "Riwayat Absen" page.
      if (!helpers.isTodayLocal(timestamp)) {
        logger.warn(`Attendance from past date - skipped auto-send`, {
          transactionId,
          time: timestamp.toISOString()
        });
        this.emit('attendance:new', {
          transactionId,
          userId: user.uid,
          userName: user.name,
          mode,
          time: timestamp,
          status: 'skipped'
        });
        return;
      }
      
      logger.info(`New attendance recorded: ${user.name} (${mode})`, { transactionId });
      
      // Send WhatsApp notification
      const sendResult = await whatsappService.sendAttendanceMessage(attendanceData);
      
      if (sendResult.success) {
        database.markAsSent(transactionId);
        logger.info(`Attendance notification sent to ${user.whatsapp_number}`, {
          transactionId,
          messageId: sendResult.result?.messageId
        });
        
        // Emit event for WebSocket clients
        this.emit('attendance:new', {
          transactionId,
          userId: user.uid,
          userName: user.name,
          mode,
          time: timestamp,
          status: 'sent'
        });
      } else {
        // Add to retry queue
        database.addToRetryQueue({
          whatsapp_number: helpers.formatWhatsAppNumber(user.whatsapp_number),
          message: sendResult.message || '',
          transaction_id: transactionId,
          max_attempts: config.retry.maxAttempts
        });
        
        database.markAsFailed(transactionId, sendResult.error);
        logger.warn(`Failed to send notification, queued for retry`, {
          transactionId,
          error: sendResult.error
        });
        
        this.emit('attendance:new', {
          transactionId,
          userId: user.uid,
          userName: user.name,
          mode,
          time: timestamp,
          status: 'failed'
        });
      }
      
    } catch (error) {
      logger.error('Error processing attendance record', {
        error: error.message,
        record
      });
    }
  }

  // Determine whether an attendance timestamp is "Masuk" or "Pulang".
  // Evaluated in Asia/Jakarta (WIB) using the configurable ranges stored in settings.
  determineMode(timestamp) {
    const time = moment(timestamp).tz(ZONE);
    const cur = time.format('HH:mm');
    
    const checkinStart = database.getSetting('checkin_start') || '00:00';
    const checkinEnd = database.getSetting('checkin_end') || '11:59';
    const checkoutStart = database.getSetting('checkout_start') || '12:00';
    const checkoutEnd = database.getSetting('checkout_end') || '23:59';
    
    if (cur >= checkinStart && cur <= checkinEnd) return 'Masuk';
    if (cur >= checkoutStart && cur <= checkoutEnd) return 'Pulang';
    
    // Fallback if ranges don't cover the time: before noon = Masuk
    return time.hour() < 12 ? 'Masuk' : 'Pulang';
  }

  startRetryProcessor() {
    const job = cron.schedule('*/1 * * * *', async () => {
      await this.processRetryQueue();
    });
    
    this.jobs.push(job);
  }

  async processRetryQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    this.lastRetryRun = new Date();
    
    try {
      const pendingRetries = database.getPendingRetries();
      
      if (pendingRetries.length === 0) return;
      
      logger.info(`Processing ${pendingRetries.length} pending retry items`);
      
      for (const retry of pendingRetries) {
        const result = await whatsappService.sendText(
          retry.whatsapp_number,
          retry.message
        );
        
        if (result.success) {
          // Message sent successfully
          database.markRetryAsSent(retry.id);
          
          // Get transaction and mark as sent
          const attendance = database.getAttendance({ userId: null });
          const existing = attendance.data.find(a => a.transaction_id === retry.transaction_id);
          
          if (existing) {
            database.markAsSent(retry.transaction_id);
          }
          
          logger.info('Retry message sent successfully', {
            retryId: retry.id,
            transactionId: retry.transaction_id
          });
          
          this.emit('retry:sent', { retryId: retry.id });
        } else {
          // Increment attempt
          const nextDelay = config.retry.delays[retry.attempt] || 900000;
          database.incrementAttempt(retry.id, nextDelay / 1000);
          
          logger.warn('Retry failed, will try again later', {
            retryId: retry.id,
            attempt: retry.attempt + 1,
            error: result.error
          });
          
          // Check if max attempts reached
          if (retry.attempt + 1 >= retry.max_attempts) {
            database.markRetryAsFailed(retry.id);
            logger.error('Retry exhausted, marking as failed', {
              retryId: retry.id,
              transactionId: retry.transaction_id
            });
            
            this.emit('retry:exhausted', { retryId: retry.id });
            
            // Alert admin about permanent failure
            alertService.sendRetryExhausted(retry.transaction_id);
          }
        }
      }
    } catch (error) {
      logger.error('Retry queue processing error', { error: error.message });
    } finally {
      this.isProcessing = false;
    }
  }

  async runDeviceHealthCheck() {
    this.lastDeviceCheck = new Date();
    
    logger.debug('Running device health check');
    
    const isOnline = await fingerprintService.checkConnection();
    
    if (!isOnline) {
      logger.warn('Device health check failed - device offline');
      this.emit('device:offline', {
        ip: config.fingerprint.ip,
        error: 'Health check failed'
      });
    } else {
      logger.debug('Device health check passed - device online');
    }
    return isOnline;
  }

  startDeviceHealthCheck() {
    // Cek langsung saat boot — status perangkat akurat sejak awal.
    this.runDeviceHealthCheck().catch((e) => logger.error('Boot device health check failed', { error: e.message }));
    
    const job = cron.schedule('*/5 * * * *', () => {
      this.runDeviceHealthCheck().catch((e) => logger.error('Device health check failed', { error: e.message }));
    });
    
    this.jobs.push(job);
  }

  async runWahaHealthCheck() {
    logger.debug('Running WAHA health check');
    
    const result = await whatsappService.checkStatus();
    
    if (!result.connected) {
      logger.warn('WAHA health check failed');
      alertService.sendWahaOffline(result.error);
    }
    return result;
  }

  startWahaHealthCheck() {
    // Cek langsung saat boot — agar status WhatsApp API langsung hijau setelah
    // container restart (tanpa menunggu menit ke-0/jadwal berikutnya).
    this.runWahaHealthCheck().catch((e) => logger.error('Boot WAHA health check failed', { error: e.message }));
    
    const job = cron.schedule('*/1 * * * *', () => {
      this.runWahaHealthCheck().catch((e) => logger.error('WAHA health check failed', { error: e.message }));
    });
    
    this.jobs.push(job);
  }

  startDailyMaintenance() {
    const job = cron.schedule('0 2 * * *', () => {
      logger.info('Running daily maintenance');
      
      // Bersihkan log device yang lebih lama dari batas retensi (hari).
      try {
        const retention = parseInt(database.getSetting('device_log_retention_days'), 10) || 30;
        const r = database.cleanupOldDeviceLogs(retention);
        logger.info(`Log device dibersihkan: ${r.deleted} dihapus (retensi ${retention} hari)`);
      } catch (e) {
        logger.error('Gagal membersihkan log device', { error: e.message || String(e) });
      }
      
      logger.info('Daily maintenance completed');
    });
    
    this.jobs.push(job);
  }

  startDatabaseBackup() {
    const job = cron.schedule('0 3 * * 0', () => {
      logger.info('Running weekly database backup');
      
      const backupPath = `./backups/attendance_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
      
      database.backupDatabase(backupPath);
    });
    
    this.jobs.push(job);
  }

  getStatus() {
    return {
      running: this.jobs.length > 0,
      jobsCount: this.jobs.length,
      lastRetryRun: this.lastRetryRun,
      lastDeviceCheck: this.lastDeviceCheck,
      isProcessing: this.isProcessing
    };
  }
}

// Singleton instance
const schedulerService = new SchedulerService();
module.exports = schedulerService;