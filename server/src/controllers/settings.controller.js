const database = require('../services/database.service');
const fingerprintService = require('../services/fingerprint.service');
const whatsappService = require('../services/whatsapp.service');
const alertService = require('../services/alert.service');
const config = require('../config');
const logger = require('../utils/logger');

class SettingsController {
  async getSettings(req, res, next) {
    try {
      const settings = {
        polling_interval: database.getSetting('polling_interval'),
        max_retry_attempts: database.getSetting('max_retry_attempts'),
        device_timeout: database.getSetting('device_timeout'),
        app_version: database.getSetting('app_version'),
        polling_enabled: database.getSetting('polling_enabled'),
        schedule_enabled: database.getSetting('schedule_enabled'),
        admin_alerts_enabled: database.getSetting('admin_alerts_enabled'),
        fingerprint_disable_before_read: database.getSetting('fingerprint_disable_before_read'),
        device_log_retention_days: database.getSetting('device_log_retention_days'),
        waha_message_delay_ms: database.getSetting('waha_message_delay_ms')
      };
      
      const schedules = database.getPollingSchedules();
      
      const configData = {
        fingerprint: {
          ip: config.fingerprint.ip,
          port: config.fingerprint.port,
          timeout: config.fingerprint.timeout,
          pollingInterval: config.fingerprint.pollingInterval
        },
        waha: {
          url: config.waha.url,
          session: config.waha.session || 'default',
          hasApiKey: !!config.waha.apiKey
        },
        admin: {
          whatsapp: config.admin.whatsapp
        },
        retry: {
          maxAttempts: config.retry.maxAttempts
        },
        modes: {
          checkin_start: database.getSetting('checkin_start') || '00:00',
          checkin_end: database.getSetting('checkin_end') || '11:59',
          checkout_start: database.getSetting('checkout_start') || '12:00',
          checkout_end: database.getSetting('checkout_end') || '23:59'
        }
      };
      
      // Live device/wa status
      const deviceStatus = fingerprintService.getStatus();
      const wahaStatus = whatsappService.getStatus();
      
      res.json({
        success: true,
        data: {
          settings,
          config: configData,
          schedules,
          status: {
            device: deviceStatus,
            waha: wahaStatus
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req, res, next) {
    try {
      const { fingerprint, waha, admin, retry, modes, settings } = req.body;
      
      if (!fingerprint && !waha && !admin && !retry && !modes && !settings) {
        return res.status(400).json({
          success: false,
          error: 'Nothing to update'
        });
      }
      
      // Apply fingerprint config
      if (fingerprint) {
        fingerprintService.applyFingerprintConfig({
          ip: fingerprint.ip,
          port: fingerprint.port,
          timeout: fingerprint.timeout,
          pollingInterval: fingerprint.pollingInterval
        });
      }
      
      // Apply WAHA config
      if (waha) {
        if (waha.url !== undefined) config.waha.url = waha.url;
        if (waha.session !== undefined) config.waha.session = waha.session;
        // Only update api key if provided non-empty (avoid wiping existing)
        if (waha.apiKey && waha.apiKey.trim().length > 0) config.waha.apiKey = waha.apiKey.trim();
      }
      
      // Apply admin config
      if (admin && admin.whatsapp) config.admin.whatsapp = admin.whatsapp;
      
      // Apply retry config
      if (retry) {
        if (retry.maxAttempts) config.retry.maxAttempts = parseInt(retry.maxAttempts);
      }
      
      // Apply Masuk/Pulang hour ranges (WIB)
      if (modes) {
        const pairs = [
          ['checkin_start', modes.checkin_start],
          ['checkin_end', modes.checkin_end],
          ['checkout_start', modes.checkout_start],
          ['checkout_end', modes.checkout_end]
        ];
        pairs.forEach(([key, value]) => {
          if (value && /^\d{2}:\d{2}$/.test(value)) database.setSetting(key, value);
        });
      }
      
      // Persist all runtime config + optional custom settings
      config.saveToDatabase(database.db);
      if (settings && typeof settings === 'object') {
        Object.keys(settings).forEach(key => database.setSetting(key, settings[key]));
      }
      
      logger.info('Settings updated via dashboard', {
        fingerprint: !!fingerprint,
        waha: !!waha,
        admin: !!admin
      });
      
      res.json({
        success: true,
        message: 'Settings updated and applied'
      });
    } catch (error) {
      next(error);
    }
  }

  async setPollingEnabled(req, res, next) {
    try {
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ success: false, error: 'enabled must be a boolean' });
      }
      
      fingerprintService.setEnabled(enabled);
      database.setSetting('polling_enabled', enabled ? '1' : '0');
      
      logger.info(`Polling set to ${enabled ? 'enabled' : 'disabled'} via dashboard`);
      
      res.json({
        success: true,
        data: { pollingEnabled: fingerprintService.pollingEnabled }
      });
    } catch (error) {
      next(error);
    }
  }

  async setScheduleMode(req, res, next) {
    try {
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ success: false, error: 'enabled must be a boolean' });
      }
      
      fingerprintService.setScheduleEnabled(enabled);
      database.setSetting('schedule_enabled', enabled ? '1' : '0');
      
      logger.info(`Schedule mode set to ${enabled ? 'enabled' : 'disabled'} via dashboard`);
      
      res.json({
        success: true,
        data: { scheduleEnabled: fingerprintService.scheduleEnabled }
      });
    } catch (error) {
      next(error);
    }
  }

  // Schedules CRUD
  getSchedules(req, res, next) {
    try {
      const schedules = database.getPollingSchedules();
      res.json({ success: true, data: schedules });
    } catch (error) {
      next(error);
    }
  }

  createSchedule(req, res, next) {
    try {
      const { day_of_week, days, start_time, end_time, is_active = 1 } = req.body;
      
      const result = database.createPollingSchedule({
        day_of_week,
        days,
        start_time,
        end_time,
        is_active
      });
      
      logger.info('Polling schedule created', result);
      
      res.status(201).json({
        success: true,
        data: { id: result.id }
      });
    } catch (error) {
      next(error);
    }
  }

  updateSchedule(req, res, next) {
    try {
      const { id } = req.params;
      const { day_of_week, days, start_time, end_time, is_active } = req.body;
      
      const result = database.updatePollingSchedule(id, {
        day_of_week,
        days,
        start_time,
        end_time,
        is_active
      });
      
      logger.info('Polling schedule updated', { id });
      
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  deleteSchedule(req, res, next) {
    try {
      const { id } = req.params;
      
      const result = database.deletePollingSchedule(id);
      
      logger.info('Polling schedule deleted', { id });
      
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Force reconnect + refresh status for both services
  async reconnect(req, res, next) {
    try {
      logger.info('Reconnecting services...');
      
      const fingerprintResult = await fingerprintService.refreshConnection(async (record) => {
        // Process any missed logs on manual refresh
        const schedulerService = require('../services/scheduler.service');
        await schedulerService.processAttendanceRecord(record);
      });
      
      const wahaResult = await whatsappService.checkStatus();
      
      res.json({
        success: true,
        data: {
          fingerprint: fingerprintResult,
          waha: wahaResult
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Manual device disconnect (pauses polling until reconnect).
  async disconnectFingerprint(req, res, next) {
    try {
      logger.info('Manual disconnect requested from dashboard');
      
      await fingerprintService.manualDisconnectAll();
      
      res.json({
        success: true,
        data: { manualDisconnected: true }
      });
    } catch (error) {
      next(error);
    }
  }

  async testWahaConnection(req, res, next) {
    try {
      logger.info('Testing WAHA connection...');
      
      const result = await whatsappService.checkStatus();
      
      res.json({
        success: result.connected,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async testFingerprintConnection(req, res, next) {
    try {
      logger.info('Testing fingerprint device connection...');
      
      const isConnected = await fingerprintService.checkConnection();
      
      res.json({
        success: isConnected,
        data: {
          connected: isConnected,
          device: {
            ip: config.fingerprint.ip,
            port: config.fingerprint.port
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async setAdminAlerts(req, res, next) {
    try {
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ success: false, error: 'enabled must be a boolean' });
      }
      
      alertService.setEnabled(enabled);
      
      res.json({
        success: true,
        data: { adminAlertsEnabled: enabled }
      });
    } catch (error) {
      next(error);
    }
  }

  // Send a "ping" test message to a manually entered number (uses `ping` template).
  async pingWaha(req, res, next) {
    try {
      const { number } = req.body;
      
      if (!number || String(number).trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Nomor WhatsApp wajib diisi'
        });
      }
      
      const helpers = require('../utils/helpers');
      const template = database.getTemplate('ping');
      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template "ping" tidak ditemukan'
        });
      }
      
      const chatId = helpers.formatWhatsAppNumber(String(number).trim());
      const message = helpers.renderTemplate(template.content, {
        // WIB — jangan pakai toLocaleString (zona server/container bisa UTC)
        datetime: helpers.formatLocalDateTime()
      });
      
      logger.info(`Ping WAHA to ${chatId}`, { number });
      
      const result = await whatsappService.sendText(chatId, message);
      
      res.json({
        success: result.success,
        data: {
          number: chatId,
          sent: result.success,
          messageId: result.messageId || null,
          error: result.error || ''
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async sendTestMessage(req, res, next) {
    try {
      const { chatId, message } = req.body;
      
      if (!chatId || !message) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: chatId, message'
        });
      }
      
      const result = await whatsappService.sendText(chatId, message);
      
      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SettingsController();