const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');

// Normalize a `days` array ([0..6], 0=Sunday) into a JSON string for storage.
// Returns null when input is empty/undefined (fallback to day_of_week).
function normalizeDays(days) {
  if (days === undefined || days === null) return null;
  
  let arr = Array.isArray(days) ? days : [days];
  arr = arr
    .map((d) => parseInt(d, 10))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  
  // Deduplicate, keep ascending sort (Sunday first)
  arr = [...new Set(arr)].sort();
  if (arr.length === 0) return null;
  
  return JSON.stringify(arr);
}

class DatabaseService {
  constructor() {
    const dbPath = config.database.path;
    console.log(`Connecting to database: ${dbPath}`);
    
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(dbPath);
      require('fs').mkdirSync(dir, { recursive: true });
      
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      
      console.log('Database connection established');
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }
  
  // Users operations
  getUser(uid) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE uid = ?');
    return stmt.get(uid);
  }
  
  getUsers(limit = 100, offset = 0) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE is_active = 1 LIMIT ? OFFSET ?');
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
    
    return {
      data: stmt.all(limit, offset),
      total: countStmt.get().count
    };
  }
  
  createUser(data) {
    const { uid, name, whatsapp_number, is_active = 1 } = data;
    const stmt = this.db.prepare(`
      INSERT INTO users (uid, name, whatsapp_number, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    
    try {
      const result = stmt.run(uid, name, whatsapp_number, is_active);
      return { id: result.lastInsertRowid };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        throw new Error(`User with UID ${uid} already exists`);
      }
      throw error;
    }
  }
  
  updateUser(uid, data) {
    const { name, whatsapp_number, is_active } = data;
    const fields = [];
    const values = [];
    
    if (name !== undefined) {
      fields.push('name = ?');
      values.push(name);
    }
    if (whatsapp_number !== undefined) {
      fields.push('whatsapp_number = ?');
      values.push(whatsapp_number);
    }
    if (is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(is_active);
    }
    
    if (fields.length === 0) {
      throw new Error('No fields to update');
    }
    
    fields.push(`updated_at = datetime('now')`);
    values.push(uid);
    
    const stmt = this.db.prepare(`
      UPDATE users 
      SET ${fields.join(', ')} 
      WHERE uid = ?
    `);
    
    const result = stmt.run(...values);
    if (result.changes === 0) {
      throw new Error(`User with UID ${uid} not found`);
    }
    
    return { success: true, changes: result.changes };
  }
  
  deleteUser(uid) {
    // Soft delete (set is_active = 0)
    const stmt = this.db.prepare('UPDATE users SET is_active = 0 WHERE uid = ?');
    const result = stmt.run(uid);
    
    if (result.changes === 0) {
      throw new Error(`User with UID ${uid} not found`);
    }
    
    return { success: true, changes: result.changes };
  }
  
  importUsersFromCSV(filePath) {
    // This will be implemented in the import script
    throw new Error('Use the import script for CSV imports');
  }
  
  // Attendance operations
  createAttendance(data) {
    const { 
      transaction_id, 
      user_id, 
      user_name, 
      whatsapp_number, 
      attendance_time, 
      mode, 
      status = 'pending' 
    } = data;
    
    const stmt = this.db.prepare(`
      INSERT INTO attendance 
      (transaction_id, user_id, user_name, whatsapp_number, attendance_time, mode, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    
    try {
      // JSON-safe serialization: Date objects cannot be bound by better-sqlite3
      const timeValue = attendance_time instanceof Date
        ? attendance_time.toISOString()
        : (attendance_time || new Date().toISOString());
      
      const result = stmt.run(
        transaction_id, 
        user_id, 
        user_name, 
        whatsapp_number, 
        timeValue, 
        mode, 
        status
      );
      return { id: result.lastInsertRowid };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        throw new Error(`Duplicate transaction ID: ${transaction_id}`);
      }
      throw error;
    }
  }
  
  getAttendance(filters = {}) {
    const { 
      date, 
      userId, 
      status, 
      limit = 100, 
      offset = 0 
    } = filters;
    
    let conditions = ['1=1'];
    let params = [];
    
    if (date) {
      conditions.push("DATE(attendance_time, '+7 hours') = DATE(?, '+7 hours')");
      params.push(date);
    }
    
    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    }
    
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    
    const whereClause = conditions.join(' AND ');
    
    const stmt = this.db.prepare(`
      SELECT * FROM attendance 
      WHERE ${whereClause}
      ORDER BY attendance_time DESC
      LIMIT ? OFFSET ?
    `);
    
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM attendance 
      WHERE ${whereClause}
    `);
    
    params.push(limit, offset);
    const countParams = params.slice(0, params.length - 2); // Remove limit/offset for count
    
    return {
      data: stmt.all(...params),
      total: countStmt.get(...countParams).count
    };
  }
  
  getAttendanceStats(date) {
    // WIB (Asia/Jakarta, UTC+7, no DST) — normalize stored UTC to local day/hour.
    const dateFilter = date
      ? "DATE(attendance_time, '+7 hours') = DATE(?, '+7 hours')"
      : "DATE(attendance_time, '+7 hours') = DATE('now', '+7 hours')";
    const params = date ? [date] : [];
    
    const totalStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM attendance WHERE ${dateFilter}
    `);
    
    const byModeStmt = this.db.prepare(`
      SELECT mode, COUNT(*) as count FROM attendance 
      WHERE ${dateFilter}
      GROUP BY mode
    `);
    
    const byStatusStmt = this.db.prepare(`
      SELECT status, COUNT(*) as count FROM attendance 
      WHERE ${dateFilter}
      GROUP BY status
    `);
    
    const hourlyStmt = this.db.prepare(`
      SELECT 
        strftime('%H', attendance_time, '+7 hours') as hour,
        COUNT(*) as count
      FROM attendance 
      WHERE ${dateFilter}
      GROUP BY strftime('%H', attendance_time, '+7 hours')
      ORDER BY hour
    `);
    
    // Binning per 10 menit (WIB) + dipisah per mode (Masuk/Pulang).
    const tenMinStmt = this.db.prepare(`
      SELECT 
        (strftime('%H', attendance_time, '+7 hours') ||
         ':' ||
         printf('%02d', (CAST(strftime('%M', attendance_time, '+7 hours') AS INTEGER) / 10) * 10)) AS bucket,
        mode,
        COUNT(*) AS count
      FROM attendance 
      WHERE ${dateFilter}
      GROUP BY bucket, mode
      ORDER BY bucket
    `);
    
    return {
      total: totalStmt.get(...params).count,
      byMode: byModeStmt.all(...params),
      byStatus: byStatusStmt.all(...params),
      hourly: hourlyStmt.all(...params),
      tenMinutes: tenMinStmt.all(...params)
    };
  }
  
  getAttendanceById(id) {
    const stmt = this.db.prepare('SELECT * FROM attendance WHERE id = ?');
    return stmt.get(id);
  }

  getAttendanceByTransactionId(transactionId) {
    const stmt = this.db.prepare('SELECT * FROM attendance WHERE transaction_id = ?');
    return stmt.get(transactionId);
  }

  markAsSent(transactionId) {
    const stmt = this.db.prepare(`
      UPDATE attendance 
      SET status = 'sent', sent_at = datetime('now') 
      WHERE transaction_id = ?
    `);
    
    const result = stmt.run(transactionId);
    if (result.changes === 0) {
      throw new Error(`Transaction ID ${transactionId} not found`);
    }
    
    return { success: true, changes: result.changes };
  }
  
  markAsFailed(transactionId, errorMessage = null) {
    const stmt = this.db.prepare(`
      UPDATE attendance 
      SET status = 'failed', error_message = ?
      WHERE transaction_id = ?
    `);
    
    const result = stmt.run(errorMessage, transactionId);
    if (result.changes === 0) {
      throw new Error(`Transaction ID ${transactionId} not found`);
    }
    
    return { success: true, changes: result.changes };
  }
  
  // Retry queue operations
  addToRetryQueue(data) {
    const { whatsapp_number, message, transaction_id, max_attempts = 3 } = data;
    
    const stmt = this.db.prepare(`
      INSERT INTO retry_queue 
      (whatsapp_number, message, transaction_id, max_attempts, next_retry_at, created_at)
      VALUES (?, ?, ?, ?, datetime('now', '+1 minutes'), datetime('now'))
    `);
    
    const result = stmt.run(whatsapp_number, message, transaction_id, max_attempts);
    return { id: result.lastInsertRowid };
  }
  
  getPendingRetries() {
    const stmt = this.db.prepare(`
      SELECT * FROM retry_queue 
      WHERE status = 'pending' 
      AND next_retry_at <= datetime('now')
      AND attempt < max_attempts
      ORDER BY created_at ASC
      LIMIT 100
    `);
    
    return stmt.all();
  }
  
  incrementAttempt(id, nextRetryDelay = 300) {
    const stmt = this.db.prepare(`
      UPDATE retry_queue 
      SET 
        attempt = attempt + 1,
        next_retry_at = datetime('now', '+' || ? || ' seconds'),
        updated_at = datetime('now')
      WHERE id = ?
    `);
    
    const result = stmt.run(nextRetryDelay, id);
    return { success: true, changes: result.changes };
  }
  
  markRetryAsSent(id) {
    const stmt = this.db.prepare(`
      UPDATE retry_queue 
      SET status = 'sent', updated_at = datetime('now')
      WHERE id = ?
    `);
    
    const result = stmt.run(id);
    return { success: true, changes: result.changes };
  }
  
  markRetryAsFailed(id) {
    const stmt = this.db.prepare(`
      UPDATE retry_queue 
      SET status = 'failed', updated_at = datetime('now')
      WHERE id = ?
    `);
    
    const result = stmt.run(id);
    return { success: true, changes: result.changes };
  }
  
  // Template operations
  getTemplate(name) {
    const stmt = this.db.prepare('SELECT * FROM templates WHERE name = ? AND is_active = 1');
    return stmt.get(name);
  }
  
  getTemplates() {
    const stmt = this.db.prepare('SELECT * FROM templates WHERE is_active = 1 ORDER BY name');
    return stmt.all();
  }
  
  createTemplate(data) {
    const { name, content, variables = '' } = data;
    
    const stmt = this.db.prepare(`
      INSERT INTO templates (name, content, variables, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `);
    
    try {
      const result = stmt.run(name, content, variables);
      return { id: result.lastInsertRowid };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        throw new Error(`Template with name "${name}" already exists`);
      }
      throw error;
    }
  }
  
  updateTemplate(id, data) {
    const { name, content, variables, is_active } = data;
    const fields = [];
    const values = [];
    
    if (name !== undefined) {
      fields.push('name = ?');
      values.push(name);
    }
    if (content !== undefined) {
      fields.push('content = ?');
      values.push(content);
    }
    if (variables !== undefined) {
      fields.push('variables = ?');
      values.push(variables);
    }
    if (is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(is_active);
    }
    
    if (fields.length === 0) {
      throw new Error('No fields to update');
    }
    
    fields.push(`updated_at = datetime('now')`);
    values.push(id);
    
    const stmt = this.db.prepare(`
      UPDATE templates 
      SET ${fields.join(', ')} 
      WHERE id = ?
    `);
    
    const result = stmt.run(...values);
    if (result.changes === 0) {
      throw new Error(`Template with ID ${id} not found`);
    }
    
    return { success: true, changes: result.changes };
  }
  
  deleteTemplate(id) {
    // Soft delete
    const stmt = this.db.prepare('UPDATE templates SET is_active = 0 WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      throw new Error(`Template with ID ${id} not found`);
    }
    
    return { success: true, changes: result.changes };
  }
  
  // Settings operations
  getSetting(key) {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get(key);
    return result ? result.value : null;
  }
  
  setSetting(key, value) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
    `);
    
    const result = stmt.run(key, value);
    return { success: true, changes: result.changes };
  }
  
  // Device logs
  logDeviceStatus(ip, status, message = null) {
    const stmt = this.db.prepare(`
      INSERT INTO device_logs (device_ip, status, message, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    
    const result = stmt.run(ip, status, message);
    return { id: result.lastInsertRowid };
  }
  
  getDeviceLogs(limit = 100) {
    const stmt = this.db.prepare(`
      SELECT * FROM device_logs 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    
    return stmt.all(limit);
  }
  
  // Polling schedules operations
  getPollingSchedules() {
    const stmt = this.db.prepare(`
      SELECT * FROM polling_schedules
      ORDER BY day_of_week ASC, start_time ASC
    `);
    return stmt.all();
  }

  getActivePollingSchedules() {
    const stmt = this.db.prepare(`
      SELECT * FROM polling_schedules
      WHERE is_active = 1
      ORDER BY day_of_week ASC, start_time ASC
    `);
    return stmt.all();
  }

  createPollingSchedule(data) {
    const { day_of_week, days, start_time, end_time, is_active = 1 } = data;
    
    const daysJson = normalizeDays(days);
    // Backward-compat: existing table has NOT NULL on day_of_week.
    // Store first selected day as the fallback column.
    let effectiveDay = day_of_week;
    if (daysJson) {
      const arr = JSON.parse(daysJson);
      if (arr.length) effectiveDay = arr[0];
    }
    
    if (daysJson === null && (day_of_week === undefined || day_of_week === null)) {
      throw new Error('Harus pilih minimal satu hari (days) atau day_of_week');
    }
    if (!start_time || !/^\d{2}:\d{2}$/.test(start_time)) {
      throw new Error('start_time must be in HH:mm format');
    }
    if (!end_time || !/^\d{2}:\d{2}$/.test(end_time)) {
      throw new Error('end_time must be in HH:mm format');
    }
    
    const stmt = this.db.prepare(`
      INSERT INTO polling_schedules 
      (day_of_week, days, start_time, end_time, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    
    const result = stmt.run(
      effectiveDay,
      daysJson,
      start_time,
      end_time,
      is_active
    );
    return { id: result.lastInsertRowid };
  }

  updatePollingSchedule(id, data) {
    const { day_of_week, days, start_time, end_time, is_active } = data;
    const fields = [];
    const values = [];
    
    if (days !== undefined) {
      const daysJson = normalizeDays(days);
      fields.push('days = ?');
      values.push(daysJson);
      
      // Keep day_of_week fallback column in sync (NOT NULL in existing tables)
      if (daysJson) {
        const arr = JSON.parse(daysJson);
        if (arr.length) {
          fields.push('day_of_week = ?');
          values.push(arr[0]);
        }
      }
    }
    if (day_of_week !== undefined) { fields.push('day_of_week = ?'); values.push(day_of_week); }
    if (start_time !== undefined) { fields.push('start_time = ?'); values.push(start_time); }
    if (end_time !== undefined) { fields.push('end_time = ?'); values.push(end_time); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active); }
    
    if (fields.length === 0) {
      throw new Error('No fields to update');
    }
    
    fields.push(`updated_at = datetime('now')`);
    values.push(id);
    
    const stmt = this.db.prepare(`
      UPDATE polling_schedules
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
    
    const result = stmt.run(...values);
    if (result.changes === 0) {
      throw new Error(`Polling schedule with ID ${id} not found`);
    }
    
    return { success: true, changes: result.changes };
  }

  deletePollingSchedule(id) {
    const stmt = this.db.prepare('DELETE FROM polling_schedules WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      throw new Error(`Polling schedule with ID ${id} not found`);
    }
    
    return { success: true, changes: result.changes };
  }

  // Hapus log device yang lebih tua dari `days` hari (jadwal harian).
  cleanupOldDeviceLogs(days = 30) {
    const stmt = this.db.prepare(
      "DELETE FROM device_logs WHERE created_at < datetime('now', '-' || ? || ' days')"
    );
    const result = stmt.run(parseInt(days) || 30);
    return { deleted: result.changes };
  }

  // Utility methods
  backupDatabase(backupPath) {
    this.db.backup(backupPath).then(() => {
      console.log(`Database backed up to: ${backupPath}`);
    }).catch(err => {
      console.error('Backup failed:', err);
      throw err;
    });
  }
  
  // Close connection
  close() {
    this.db.close();
    console.log('Database connection closed');
  }
}

// Singleton instance
const databaseService = new DatabaseService();
module.exports = databaseService;
