const config = require('../config');
const logger = require('../utils/logger');
const whatsappService = require('./whatsapp.service');
const database = require('./database.service');
const helpers = require('../utils/helpers');

class AlertService {
  constructor() {
    this.lastOfflineAlert = null;
    this.lastWahaOfflineAlert = null;
    this.alertCooldownMinutes = 15; // Don't send same alert more than once per 15 min
    this.offlineNotified = false; // Reset only when the device comes back online
  }

  // Master switch for admin notifications, persisted in settings table.
  isEnabled() {
    try {
      return database.getSetting('admin_alerts_enabled') !== '0';
    } catch (e) {
      return true;
    }
  }

  setEnabled(enabled) {
    database.setSetting('admin_alerts_enabled', enabled ? '1' : '0');
    logger.info(`Admin alerts ${enabled ? 'ENABLED' : 'DISABLED'}`);
    return enabled;
  }

async handleDeviceOffline(data) {
    if (!this.isEnabled()) {
      logger.info('Admin alerts disabled - skipping device offline alert');
      return { success: false, skipped: true };
    }
    
    const { ip, error } = data;
    
    // Send the offline alert ONCE per outage episode, not again until the
    // device connects back (handleDeviceRecovery resets this flag).
    if (this.offlineNotified) {
      logger.debug('Offline alert already sent for this episode - skipping');
      return { success: false, skipped: true };
    }
    this.offlineNotified = true;
    
    const now = new Date();
    const formattedTime = helpers.formatLocalDateTime(now);
    
    const message = `*ALERT: Perangkat Fingerprint Offline*\n\n` +
      `IP: ${ip || config.fingerprint.ip}\n` +
      `Waktu: ${formattedTime}\n\n` +
      `Error: ${error || 'Koneksi gagal'}\n\n` +
      `Mohon periksa koneksi perangkat!`;

    logger.warn(`Sending device offline alert to admin (${config.admin.whatsapp})`);
    
    const result = await whatsappService.sendAlert(message);
    
    if (result.success) {
      logger.info('Device offline alert sent successfully');
    } else {
      logger.error('Failed to send device offline alert', { error: result.error });
    }
    
    return result;
  }

  async handleDeviceRecovery(ip) {
    // Reset episode flag FIRST so the next outage can produce a fresh alert.
    this.offlineNotified = false;
    
    if (!this.isEnabled()) {
      logger.info('Admin alerts disabled - skipping device recovery alert');
      return { success: false, skipped: true };
    }
    
    const formattedTime = helpers.formatLocalDateTime()
    
    const message = `*Perangkat Fingerprint Kembali Online*\n\n` +
      `IP: ${ip || config.fingerprint.ip}\n` +
      `Waktu: ${formattedTime}\n\n` +
      `Perangkat berhasil terhubung kembali.`;
    
    logger.info(`Sending device recovery alert to admin (${config.admin.whatsapp})`);
    
    const result = await whatsappService.sendAlert(message);
    
    if (result.success) {
      logger.info('Device recovery alert sent successfully');
    }
    
    return result;
  }

  async sendWahaOffline(error) {
    if (!this.isEnabled()) {
      logger.info('Admin alerts disabled - skipping WAHA offline alert');
      return { success: false, skipped: true };
    }
    
    // Rate limiting
    if (this.lastWahaOfflineAlert && 
        (new Date() - this.lastWahaOfflineAlert) < this.alertCooldownMinutes * 60 * 1000) {
      logger.debug('Skipping WAHA offline alert (cooldown active)');
      return;
    }
    
    this.lastWahaOfflineAlert = new Date();
    
    const formattedTime = helpers.formatLocalDateTime()
    
    const message = `*ALERT: WAHA WhatsApp API Offline*\n\n` +
      `URL: ${config.waha.url}\n` +
      `Waktu: ${formattedTime}\n\n` +
      `Error: ${error || 'Tidak dapat terhubung keporn WAHA'}\n\n` +
      `Pesan WhatsApp tidak dapat dikirim. Mohon periksa WAHA service!`;
    
    logger.warn('Sending WAHA offline alert to admin');
    
    const result = await whatsappService.sendAlert(message);
    
    if (result.success) {
      logger.info('WAHA offline alert sent successfully');
    }
    
    return result;
  }

  async sendRetryExhausted(transactionId) {
    if (!this.isEnabled()) {
      logger.info('Admin alerts disabled - skipping retry exhausted alert');
      return { success: false, skipped: true };
    }
    
    const formattedTime = helpers.formatLocalDateTime()
    
    const message = `*ALERT: Pengiriman Pesan Gagal Permanen*\n\n` +
      `Transaction ID: ${transactionId}\n` +
      `Waktu: ${formattedTime}\n\n` +
      `Semua percobaan retry telah habis. Pesan tidak dapat dikirim.\n` +
      `Mohon cek WhatsApp API atau lakukan pengiriman manual.`;
    
    logger.error('Sending retry exhausted alert to admin');
    
    const result = await whatsappService.sendAlert(message);
    
    if (result.success) {
      logger.info('Retry exhausted alert sent successfully');
    }
    
    return result;
  }

  async sendErrorAlert(error, context = {}) {
    if (!this.isEnabled()) {
      logger.info('Admin alerts disabled - skipping system error alert');
      return { success: false, skipped: true };
    }
    
    const formattedTime = helpers.formatLocalDateTime()
    
    const message = `*ALERT: Error Sistem*\n\n` +
      `Waktu: ${formattedTime}\n` +
      `Error: ${error}\n` +
      `Context: ${JSON.stringify(context)}\n\n` +
      `Mohon periksa log aplikasi untuk detail lebih lanjut.`;
    
    const result = await whatsappService.sendAlert(message);
    
    return result;
  }
}

// Singleton instance
const alertService = new AlertService();
module.exports = alertService;