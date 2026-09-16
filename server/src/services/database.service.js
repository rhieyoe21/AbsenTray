const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');

// SQLite modifier untuk timestamp lokal (mis. '+420 minutes' untuk Asia/Jakarta).
// Semua created_at/updated_at/sent_at diisi pakai ini — kecuali attendance_time
// yang sengaja dibiarkan apa adanya (absolut dari mesin) agar tetap akurat.
const LOCAL_MODIFIER = config.sqliteLocalNowModifier();

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
      
      this._runIdempotentMigrations();
      
      console.log('Database connection established');
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }

  // Migrasi kecil yang aman dijalankan ulang: menambah kolom baru & melonggarkan
  // CHECK constraint status tanpa migrasi versi penuh.
  _runIdempotentMigrations() {
    // 1) users.notify_enabled — toggle kirim notifikasi WhatsApp per user.
    const userCols = this.db.prepare('PRAGMA table_info(users)').all();
    if (!userCols.some((c) => c.name === 'notify_enabled')) {
      this.db.prepare(`
        ALTER TABLE users
        ADD COLUMN notify_enabled INTEGER NOT NULL DEFAULT 1 CHECK (notify_enabled IN (0, 1))
      `).run();
      console.log('Migration: users.notify_enabled ditambahkan');
    }
    
    // 2) attendance.status harus menerima 'skipped' (absen tercatat tapi WA
    //    sengaja tidak dikirim). Hanya perlu rebuild bila tabel lama punya CHECK.
    const attTable = this.db.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'attendance'"
    ).get();
    const attSql = attTable?.sql || '';
    if (/CHECK\s*\(status\s*IN/i.test(attSql) && !/skipped/.test(attSql)) {
      const fkBefore = !!this.db.pragma('foreign_keys', { simple: true });
      this.db.pragma('foreign_keys = OFF');
      const rebuild = this.db.transaction(() => {
        this.db.exec(`
          CREATE TABLE attendance_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id TEXT UNIQUE NOT NULL,
            user_id TEXT NOT NULL,
            user_name TEXT NOT NULL,
            whatsapp_number TEXT NOT NULL,
            attendance_time DATETIME NOT NULL,
            mode TEXT NOT NULL,
            status TEXT DEFAULT 'pending'
              CHECK (status IN ('pending', 'sent', 'failed', 'retrying', 'skipped')),
            sent_at DATETIME,
            error_message TEXT,
            created_at DATETIME DEFAULT (datetime('now', '${LOCAL_MODIFIER}')),
            FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE RESTRICT
          );
          INSERT INTO attendance_new
            (id, transaction_id, user_id, user_name, whatsapp_number, attendance_time,
             mode, status, sent_at, error_message, created_at)
          SELECT id, transaction_id, user_id, user_name, whatsapp_number, attendance_time,
                 mode, status, sent_at, error_message, created_at FROM attendance;
          DROP TABLE attendance;
          ALTER TABLE attendance_new RENAME TO attendance;
          CREATE INDEX IF NOT EXISTS idx_attendance_time ON attendance(attendance_time);
          CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
          CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
        `);
      });
      rebuild();
      this.db.pragma(`foreign_keys = ${fkBefore ? 'ON' : 'OFF'}`);
      console.log('Migration: attendance.status kini mendukung "skipped"');
    }
  }
  
  // Users operations
  getUser(uid) {
    // Hanya user AKTIF. User yang di-soft-delete (is_active=0) tidak boleh
    // dipakai sebagai penerima absen/notifikasi baru.
    const stmt = this.db.prepare('SELECT * FROM users WHERE uid = ? AND is_active = 1');
    return stmt.get(uid);
  }

  // Untuk keperluan khusus (mis. impor ulang): temukan user walau nonaktif.
  getUserIncludingInactive(uid) {
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
    const { uid, name, whatsapp_number, is_active = 1, notify_enabled = 1 } = data;
    const stmt = this.db.prepare(`
      INSERT INTO users (uid, name, whatsapp_number, is_active, notify_enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', '${LOCAL_MODIFIER}'), datetime('now', '${LOCAL_MODIFIER}'))
    `);
    
    try {
      const result = stmt.run(uid, name, whatsapp_number, is_active, notify_enabled);
      return { id: result.lastInsertRowid };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        throw new Error(`User with UID ${uid} already exists`);
      }
      throw error;
    }
  }
  
  // Re-aktifkan user yang sebelumnya di-nonaktifkan (soft delete) sambil
  // memperbarui data. Dipakai saat import ulang.
  reactivateUser(uid, data) {
    const { name, whatsapp_number } = data;
    const stmt = this.db.prepare(`
      UPDATE users
      SET is_active = 1,
          name = COALESCE(?, name),
          whatsapp_number = COALESCE(?, whatsapp_number),
          updated_at = datetime('now', '${LOCAL_MODIFIER}')
      WHERE uid = ?
    `);
    const result = stmt.run(name ?? null, whatsapp_number ?? null, uid);
    return { success: true, changes: result.changes };
  }
  
  updateUser(uid, data) {
    const { name, whatsapp_number, is_active, notify_enabled } = data;
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
      values.push(is_active ? 1 : 0);
    }
    if (notify_enabled !== undefined) {
      fields.push('notify_enabled = ?');
      values.push(notify_enabled ? 1 : 0);
    }
    
    if (fields.length === 0) {
      throw new Error('No fields to update');
    }
    
    fields.push(`updated_at = datetime('now', '${LOCAL_MODIFIER}')`);
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
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '${LOCAL_MODIFIER}'))
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
      conditions.push(`DATE(attendance_time, '${LOCAL_MODIFIER}') = DATE(?, '${LOCAL_MODIFIER}')`);
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
      ? `DATE(attendance_time, '${LOCAL_MODIFIER}') = DATE(?, '${LOCAL_MODIFIER}')`
      : `DATE(attendance_time, '${LOCAL_MODIFIER}') = DATE('now', '${LOCAL_MODIFIER}')`;
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
        strftime('%H', attendance_time, '${LOCAL_MODIFIER}') as hour,
        COUNT(*) as count
      FROM attendance 
      WHERE ${dateFilter}
      GROUP BY strftime('%H', attendance_time, '${LOCAL_MODIFIER}')
      ORDER BY hour
    `);
    
    // Binning per 10 menit (WIB) + dipisah per mode (Masuk/Pulang).
    const tenMinStmt = this.db.prepare(`
      SELECT 
        (strftime('%H', attendance_time, '${LOCAL_MODIFIER}') ||
         ':' ||
         printf('%02d', (CAST(strftime('%M', attendance_time, '${LOCAL_MODIFIER}') AS INTEGER) / 10) * 10)) AS bucket,
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
      SET status = 'sent', sent_at = datetime('now', '${LOCAL_MODIFIER}') 
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

  // Ubah status pengiriman beberapa absen sekaligus (bulk action di History).
  // Mode 1: `ids` (array id baris tertentu). Mode 2: `filter` (object
  // {date,userId,status}) — berlaku untuk SEMUA baris yang cocok, termasuk
  // di luar halaman pagination. Status sent mengisi sent_at, pending mengosongkannya.
  bulkSetAttendanceStatus({ ids, filter, status }) {
    const allowed = ['sent', 'pending'];
    if (!allowed.includes(status)) {
      throw new Error(`Status "${status}" tidak didukung untuk bulk action`);
    }

    const setClause = status === 'sent'
      ? `SET status = 'sent', sent_at = datetime('now', '${LOCAL_MODIFIER}')`
      : `SET status = 'pending', sent_at = NULL`;
    const setSentAt = status === 'sent';

    let whereClause;
    let params;
    if (Array.isArray(ids) && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(', ');
      whereClause = `WHERE id IN (${placeholders})`;
      params = ids;
    } else if (filter && typeof filter === 'object') {
      const conds = ['1=1'];
      const fparams = [];
      if (filter.date) {
        conds.push(`DATE(attendance_time, '${LOCAL_MODIFIER}') = DATE(?, '${LOCAL_MODIFIER}')`);
        fparams.push(filter.date);
      }
      if (filter.userId) {
        conds.push('user_id = ?');
        fparams.push(filter.userId);
      }
      if (filter.status) {
        conds.push('status = ?');
        fparams.push(filter.status);
      }
      whereClause = `WHERE ${conds.join(' AND ')}`;
      params = fparams;
    } else {
      throw new Error('ids (array) atau filter wajib diisi');
    }

    const stmt = this.db.prepare(`UPDATE attendance ${setClause} ${whereClause}`);
    const result = stmt.run(...params);
    return { success: true, updated: result.changes };
  }
  
  // Retry queue operations
  addToRetryQueue(data) {
    const { whatsapp_number, message, transaction_id, max_attempts = 3 } = data;
    
    const stmt = this.db.prepare(`
      INSERT INTO retry_queue 
      (whatsapp_number, message, transaction_id, max_attempts, next_retry_at, created_at)
      VALUES (?, ?, ?, ?, datetime('now', '${LOCAL_MODIFIER}', '+1 minutes'), datetime('now', '${LOCAL_MODIFIER}'))
    `);
    
    const result = stmt.run(whatsapp_number, message, transaction_id, max_attempts);
    return { id: result.lastInsertRowid };
  }
  
  getPendingRetries() {
    const stmt = this.db.prepare(`
      SELECT * FROM retry_queue 
      WHERE status = 'pending' 
      AND next_retry_at <= datetime('now', '${LOCAL_MODIFIER}')
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
        next_retry_at = datetime('now', '${LOCAL_MODIFIER}', '+' || ? || ' seconds'),
        updated_at = datetime('now', '${LOCAL_MODIFIER}')
      WHERE id = ?
    `);
    
    const result = stmt.run(nextRetryDelay, id);
    return { success: true, changes: result.changes };
  }
  
  markRetryAsSent(id) {
    const stmt = this.db.prepare(`
      UPDATE retry_queue 
      SET status = 'sent', updated_at = datetime('now', '${LOCAL_MODIFIER}')
      WHERE id = ?
    `);
    
    const result = stmt.run(id);
    return { success: true, changes: result.changes };
  }
  
  markRetryAsFailed(id) {
    const stmt = this.db.prepare(`
      UPDATE retry_queue 
      SET status = 'failed', updated_at = datetime('now', '${LOCAL_MODIFIER}')
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
      VALUES (?, ?, ?, datetime('now', '${LOCAL_MODIFIER}'), datetime('now', '${LOCAL_MODIFIER}'))
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
    
    fields.push(`updated_at = datetime('now', '${LOCAL_MODIFIER}')`);
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
      VALUES (?, ?, datetime('now', '${LOCAL_MODIFIER}'))
    `);
    
    const result = stmt.run(key, value);
    return { success: true, changes: result.changes };
  }
  
  // Device logs
  logDeviceStatus(ip, status, message = null) {
    const stmt = this.db.prepare(`
      INSERT INTO device_logs (device_ip, status, message, created_at)
      VALUES (?, ?, ?, datetime('now', '${LOCAL_MODIFIER}'))
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
      VALUES (?, ?, ?, ?, ?, datetime('now', '${LOCAL_MODIFIER}'), datetime('now', '${LOCAL_MODIFIER}'))
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
    
    fields.push(`updated_at = datetime('now', '${LOCAL_MODIFIER}')`);
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
      `DELETE FROM device_logs WHERE created_at < datetime('now', '${LOCAL_MODIFIER}', '-' || ? || ' days')`
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
