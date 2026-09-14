class UserModel {
  constructor(data) {
    this.id = data.id;
    this.uid = data.uid;
    this.name = data.name;
    this.whatsapp_number = data.whatsapp_number;
    this.is_active = data.is_active;
    this.created_at = new Date(data.created_at);
    this.updated_at = new Date(data.updated_at);
  }

  // Validation methods
  static validate(data) {
    const errors = [];
    
    if (!data.uid || data.uid.trim().length === 0) {
      errors.push('UID is required');
    }
    
    if (!data.name || data.name.trim().length === 0) {
      errors.push('Name is required');
    }
    
    if (!data.whatsapp_number || data.whatsapp_number.trim().length === 0) {
      errors.push('WhatsApp number is required');
    } else if (!/^[0-9]+$/.test(data.whatsapp_number.replace(/[^0-9]/g, ''))) {
      errors.push('WhatsApp number must contain only digits');
    }
    
    return errors;
  }

  // Format for API response
  toJSON() {
    return {
      id: this.id,
      uid: this.uid,
      name: this.name,
      whatsapp_number: this.whatsapp_number,
      is_active: this.is_active,
      created_at: this.created_at.toISOString(),
      updated_at: this.updated_at.toISOString()
    };
  }

  // Format for CSV export
  toCSV() {
    return {
      uid: this.uid,
      name: this.name,
      whatsapp_number: this.whatsapp_number
    };
  }

  // Format WhatsApp number for sending messages
  getWhatsAppChatId() {
    const cleaned = this.whatsapp_number.replace(/\D/g, '');
    
    if (cleaned.startsWith('0')) {
      return cleaned.substring(1) + '@c.us';
    }
    
    return cleaned + '@c.us';
  }
}

module.exports = UserModel;
