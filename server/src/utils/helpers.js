const moment = require('moment-timezone');

const formatters = {
  // Format attendance time to Indonesian format
  formatAttendanceTime(date) {
    return moment(date).tz('Asia/Jakarta').locale('id').format('dddd, DD MMMM YYYY, HH:mm');
  },

  // Format short date
  formatDate(date) {
    return moment(date).tz('Asia/Jakarta').format('DD/MM/YYYY');
  },

  // Format time only
  formatTime(date) {
    return moment(date).tz('Asia/Jakarta').format('HH:mm:ss');
  },

  // Format ISO datetime
  formatISO(date) {
    return moment(date).toISOString();
  },

  // Parse phone number to WhatsApp format
  formatWhatsAppNumber(number) {
    // Remove any non-digit characters
    const cleaned = number.replace(/\D/g, '');
    
    // If starts with 0, replace with 62 (Indonesia)
    if (cleaned.startsWith('0')) {
      return cleaned.substring(1) + '@c.us';
    }
    
    // Otherwise assume it's already without 0
    return cleaned + '@c.us';
  },

  // Render template with variables
  renderTemplate(template, variables = {}) {
    let content = template;
    
    // SQLite stores literal "\n" (backslash + n) as-is in single-quoted strings.
    // Convert those literal escapes into real line breaks before sending.
    content = content.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '');
    
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      content = content.replace(regex, variables[key]);
    });
    
    return content;
  },

  // Get transaction ID (uid + timestamp)
  getTransactionId(uid, datetime) {
    return `${uid}-${moment(datetime).format('YYYYMMDDHHmmss')}`;
  },

  // Check whether a date falls on "today" in the local timezone
  isTodayLocal(date, tz = 'Asia/Jakarta') {
    return moment(date).tz(tz).format('YYYY-MM-DD') === moment().tz(tz).format('YYYY-MM-DD');
  }
};

module.exports = formatters;
