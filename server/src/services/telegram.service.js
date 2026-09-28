const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

class TelegramService {
  get token() {
    return String(config.admin.telegramBotToken || '').trim();
  }

  get chatId() {
    return String(config.admin.telegramChatId || '').trim();
  }

  async call(method, data = {}) {
    if (!this.token) {
      return { success: false, error: 'Token Telegram bot belum dikonfigurasi' };
    }

    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${this.token}/${method}`,
        data,
        { timeout: 10000 }
      );
      const body = response.data;
      if (!body?.ok) return { success: false, error: body?.description || 'Telegram API gagal' };
      return { success: true, data: body.result };
    } catch (error) {
      const message = error.response?.data?.description || error.message || 'Telegram API tidak dapat dihubungi';
      logger.error('Telegram API request failed', { method, error: message });
      return { success: false, error: message };
    }
  }

  async getMe() {
    return this.call('getMe');
  }

  async sendMessage(message, chatId = this.chatId) {
    if (!chatId) return { success: false, error: 'Telegram user/chat ID belum dikonfigurasi' };
    return this.call('sendMessage', {
      chat_id: chatId,
      text: message
    });
  }

  async testConnection() {
    const bot = await this.getMe();
    if (!bot.success) return bot;
    if (!this.chatId) return { success: true, bot: bot.data, messageSent: false };

    const message = `AbsenTray Telegram aktif\nBot: @${bot.data.username || bot.data.first_name}\nWaktu: ${new Date().toISOString()}`;
    const sent = await this.sendMessage(message);
    return { ...sent, bot: bot.data, messageSent: sent.success };
  }
}

module.exports = new TelegramService();
