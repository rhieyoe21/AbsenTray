const moment = require('moment-timezone');

class AttendanceModel {
  constructor(data) {
    this.id = data.id;
    this.transaction_id = data.transaction_id;
    this.user_id = data.user_id;
    this.user_name = data.user_name;
    this.whatsapp_number = data.whatsapp_number;
    this.attendance_time = new Date(data.attendance_time);
    this.mode = data.mode;
    this.status = data.status;
    this.sent_at = data.sent_at ? new Date(data.sent_at) : null;
    this.error_message = data.error_message;
    this.created_at = new Date(data.created_at);
  }

  // Validation methods
  static validate(data) {
    const errors = [];
    
    if (!data.transaction_id || data.transaction_id.trim().length === 0) {
      errors.push('Transaction ID is required');
    }
    
    if (!data.user_id || data.user_id.trim().length === 0) {
      errors.push('User ID is required');
    }
    
    if (!data.user_name || data.user_name.trim().length === 0) {
      errors.push('User name is required');
    }
    
    if (!data.whatsapp_number || data.whatsapp_number.trim().length === 0) {
      errors.push('WhatsApp number is required');
    }
    
    if (!data.attendance_time) {
      errors.push('Attendance time is required');
    }
    
    if (!data.mode || !['Masuk', 'Pulang'].includes(data.mode)) {
      errors.push('Mode must be either "Masuk" or "Pulang"');
    }
    
    if (data.status && !['pending', 'sent', 'failed', 'retrying'].includes(data.status)) {
      errors.push('Invalid status value');
    }
    
    return errors;
  }

  // Format for API response
  toJSON() {
    const attendanceTime = moment(this.attendance_time).tz('Asia/Jakarta').locale('id');
    
    return {
      id: this.id,
      transaction_id: this.transaction_id,
      user_id: this.user_id,
      user_name: this.user_name,
      whatsapp_number: this.whatsapp_number,
      attendance_time: this.attendance_time.toISOString(),
      formatted_time: attendanceTime.format('dddd, DD MMMM YYYY, HH:mm'),
      mode: this.mode,
      status: this.status,
      sent_at: this.sent_at ? this.sent_at.toISOString() : null,
      error_message: this.error_message,
      created_at: this.created_at.toISOString()
    };
  }

  // Check if this is a duplicate (same user, same day)
  isDuplicate(existingRecords) {
    const today = moment(this.attendance_time).startOf('day');
    
    return existingRecords.some(record => {
      const recordDate = moment(record.attendance_time).startOf('day');
      return record.user_id === this.user_id && 
             today.isSame(recordDate) &&
             record.mode === this.mode;
    });
  }

  // Calculate if should be retried based on status and time
  shouldRetry() {
    if (this.status !== 'failed') return false;
    
    // Only retry if created within last 24 hours
    const created = moment(this.created_at);
    const now = moment();
    const hoursDiff = now.diff(created, 'hours');
    
    return hoursDiff < 24;
  }

  // Get WhatsApp message format
  getWhatsAppMessage() {
    const attendanceTime = moment(this.attendance_time).tz('Asia/Jakarta');
    const date = attendanceTime.format('dddd, DD MMMM YYYY');
    const time = attendanceTime.format('HH:mm');
    
    return `✅ *Presensi ${this.mode}*\n` +
           `Nama: ${this.user_name}\n` +
           `UID: ${this.user_id}\n` +
           `Hari: ${date}\n` +
           `Jam: ${time}`;
  }
}

module.exports = AttendanceModel;
