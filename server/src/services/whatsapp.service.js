const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const database = require('./database.service');
const helpers = require('../utils/helpers');

class WhatsAppService {
  constructor() {
    this.wahaUrl = config.waha.url;
    this.apiKey = config.waha.apiKey;
    this.session = config.waha.session;
    this.lastMessage = null;
    this.lastNumber = null;
    this.lastSendTime = null;
    this.connected = false;
    
    logger.info('WhatsAppService initialized', {
      url: this.wahaUrl,
      session: this.session
    });
  }

  // Jeda minimal antar pengiriman pesan (ms), diambil dari settings sehingga
  // bisa diubah runtime. 0 = tanpa jeda.
  async _throttle() {
    let minGap = 2000;
    try {
      const v = parseInt(database.getSetting('waha_message_delay_ms'), 10);
      if (!Number.isNaN(v)) minGap = Math.max(v, 0);
    } catch (e) { /* default */ }
    
    const now = Date.now();
    if (this._lastSendAt && now - this._lastSendAt < minGap) {
      const wait = minGap - (now - this._lastSendAt);
      await new Promise((r) => setTimeout(r, wait));
    }
    this._lastSendAt = Date.now();
  }

  async sendText(chatId, text, options = {}) {
    // Jeda minimal antar pengiriman — agar pesan absen berurutan tidak
    // dikirim serentak (menghindari rate-limit & "pintu" pengiriman).
    await this._throttle();
    
    // Read live config — supports runtime setting changes without restart
    const wahaUrl = config.waha.url;
    const apiKey = config.waha.apiKey;
    const session = options.session || config.waha.session || 'default';
    const url = `${wahaUrl}/api/sendText`;
    
    const payload = {
      session,
      chatId,
      text
    };
    
    if (options.reply_to) {
      payload.reply_to = options.reply_to;
    }
    
    if (options.linkPreview !== undefined) {
      payload.linkPreview = options.linkPreview;
    }
    
    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey
        },
        timeout: 30000
      });
      
      const result = response.data;
      
      // Update connection status
      this.connected = true;
      
      logger.info(`Message sent to ${chatId}`, {
        messageId: result.id || null,
        timestamp: result.timestamp || null
      });
      
      return {
        success: true,
        messageId: result.id,
        data: result
      };
    } catch (error) {
      if (error.response) {
        // WAHA API returned an error
        logger.error(`WAHA API error (${error.response.status})`, {
          data: error.response.data,
          url: url
        });
        
        this.connected = true; // Connected but request failed
        
        const errData = error.response.data || error.response.statusText;
        return {
          success: false,
          status: error.response.status,
          error: typeof errData === 'string' ? errData : JSON.stringify(errData),
          message: error.message
        };
      } else if (error.request) {
        // Request made but no response (timeout, connection refused)
        logger.error('WAHA request failed (no response)', {
          error: error.message,
          code: error.code
        });
        
        this.connected = false;
        
        return {
          success: false,
          error: 'No response from WAHA server',
          message: error.message,
          code: error.code
        };
      } else {
        // Something happened in setting up the request
        logger.error('WAHA request setup error', { error: error.message });
        
        return {
          success: false,
          error: error.message
        };
      }
    }
  }

  async sendTemplate(templateName, variables, chatId) {
    try {
      // Get template from database
      const template = database.getTemplate(templateName);
      
      if (!template) {
        throw new Error(`Template "${templateName}" not found`);
      }
      
      // Render template with variables
      const message = helpers.renderTemplate(template.content, variables);
      
      // Send message
      const result = await this.sendText(chatId, message);
      
      return {
        success: result.success,
        message,
        result
      };
    } catch (error) {
      logger.error('Failed to send template', {
        template: templateName,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Build + send an attendance message from a stored attendance record.
  // Used by scheduler (auto) and manual resend endpoint.
  async sendAttendanceMessage(record) {
    const chatId = helpers.formatWhatsAppNumber(record.whatsapp_number);
    
    const timeM = require('moment-timezone')(record.attendance_time).tz('Asia/Jakarta').locale('id');
    const variables = {
      name: record.user_name || record.name,
      uid: record.user_id || record.uid,
      date: timeM.format('dddd, DD MMMM YYYY'),
      time: timeM.format('HH:mm:ss'),
      mode: record.mode
    };
    
    const template = database.getTemplate('attendance_notification');
    if (!template) {
      throw new Error('Template "attendance_notification" not found');
    }
    
    const message = helpers.renderTemplate(template.content, variables);
    const result = await this.sendText(chatId, message);
    
    // Normalize so error is always a safe string (never object/undefined).
    return {
      success: result.success,
      message,
      messageId: result.messageId || null,
      status: result.status,
      error: (result.error || '') + (result.error && result.message ? ' — ' + result.message : '') || ''
    };
  }

  async sendAttendanceNotification(attendanceData) {
    const { name, uid, date, time, mode, whatsapp } = attendanceData;
    const chatId = helpers.formatWhatsAppNumber(whatsapp);
    
    const variables = {
      name,
      uid,
      date, // Pretty formatted date
      time, // Pretty formatted time
      mode
    };
    
    return this.sendTemplate('attendance_notification', variables, chatId);
  }

  async sendDeviceOfflineAlert(ip, datetime) {
    const adminNumber = config.admin.whatsapp;
    const chatId = helpers.formatWhatsAppNumber(adminNumber);
    
    const variables = {
      ip,
      datetime
    };
    
    return this.sendTemplate('device_offline_alert', variables, chatId);
  }

  async sendAlert(message, adminNumber = config.admin.whatsapp) {
    const chatId = helpers.formatWhatsAppNumber(adminNumber);
    return this.sendText(chatId, message);
  }

  // WAHA exposes GET /health (see https://waha.devlike.pro/docs/how-to/observability).
  // A 200 response means the WhatsApp HTTP API is up — use that as the connection health.
  async checkStatus() {
    try {
      const url = `${config.waha.url}/health`;
      
      const response = await axios.get(url, {
        headers: {
          'X-Api-Key': config.waha.apiKey
        },
        timeout: 5000
      });
      
      const ok = response.status === 200;
      this.connected = ok;
      this.lastCheckAt = new Date();
      
      if (ok) {
        logger.info('WAHA connection verified', { session: config.waha.session, url });
      } else {
        logger.warn('WAHA health returned non-200', { status: response.status });
      }
      
      return { connected: ok, status: response.data, url };
    } catch (error) {
      this.connected = false;
      this.lastCheckAt = new Date();
      
      const errMsg = error.response
        ? `WAHA health error ${error.response.status}`
        : (error.code || error.message || 'no response');
      
      logger.error('WAHA health check failed', {
        error: errMsg,
        code: error.code
      });
      
      return { connected: false, error: errMsg };
    }
  }

  getStatus() {
    return {
      connected: this.connected,
      url: config.waha.url,
      session: config.waha.session || 'default',
      hasApiKey: !!config.waha.apiKey,
      lastMessage: this.lastMessage,
      lastNumber: this.lastNumber,
      lastSendTime: this.lastSendTime,
      lastCheckAt: this.lastCheckAt || null
    };
  }
}

// Singleton instance
const whatsappService = new WhatsAppService();
module.exports = whatsappService;