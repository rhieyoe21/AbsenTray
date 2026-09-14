-- AbsenTray V2 Database Schema
-- Version: 1.0.0

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    whatsapp_number TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at DATETIME DEFAULT (datetime('now', '+7 hours')),
    updated_at DATETIME DEFAULT (datetime('now', '+7 hours'))
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    whatsapp_number TEXT NOT NULL,
    attendance_time DATETIME NOT NULL,
    mode TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
    sent_at DATETIME,
    error_message TEXT,
    created_at DATETIME DEFAULT (datetime('now', '+7 hours')),
    FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE RESTRICT
);

-- Retry queue
CREATE TABLE IF NOT EXISTS retry_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    whatsapp_number TEXT NOT NULL,
    message TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    attempt INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_retry_at DATETIME,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    created_at DATETIME DEFAULT (datetime('now', '+7 hours')),
    updated_at DATETIME DEFAULT (datetime('now', '+7 hours'))
);

-- Message templates
CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    variables TEXT,
    is_active BOOLEAN DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at DATETIME DEFAULT (datetime('now', '+7 hours')),
    updated_at DATETIME DEFAULT (datetime('now', '+7 hours'))
);

-- System settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT (datetime('now', '+7 hours'))
);

-- Device status log
CREATE TABLE IF NOT EXISTS device_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_ip TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('online', 'offline', 'error', 'connecting')),
    message TEXT,
    created_at DATETIME DEFAULT (datetime('now', '+7 hours'))
);

-- Polling schedules (multi-schedule: which hours on which days to poll)
-- `days` stores a JSON array of selected weekdays [0..6] (0=Sunday); when
-- present it replaces the single `day_of_week` (kept for backward compat).
CREATE TABLE IF NOT EXISTS polling_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    days TEXT,
    start_time TEXT NOT NULL CHECK (length(start_time) = 5),
    end_time TEXT NOT NULL CHECK (length(end_time) = 5),
    is_active BOOLEAN DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at DATETIME DEFAULT (datetime('now', '+7 hours')),
    updated_at DATETIME DEFAULT (datetime('now', '+7 hours'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_attendance_time ON attendance(attendance_time);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_retry_status ON retry_queue(status);
CREATE INDEX IF NOT EXISTS idx_retry_next ON retry_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_device_logs_ip ON device_logs(device_ip);
CREATE INDEX IF NOT EXISTS idx_device_logs_time ON device_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_schedules_day ON polling_schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_schedules_active ON polling_schedules(is_active);

-- Default templates
INSERT OR IGNORE INTO templates (name, content, variables) VALUES
('attendance_notification', 
 '✅ *Presensi {mode}*' || char(10) || 'Nama: {name}' || char(10) || 'UID: {uid}' || char(10) || 'Hari: {date}' || char(10) || 'Jam: {time}',
 'name,uid,date,time,mode'),
('device_offline_alert',
 '⚠️ *ALERT: Perangkat Fingerprint Offline*' || char(10) || char(10) || 'IP: {ip}' || char(10) || 'Waktu: {datetime}' || char(10) || char(10) || 'Mohon periksa koneksi perangkat!',
 'ip,datetime'),
('retry_success',
 '✅ [RETRY] Pesan berhasil dikirim ulang' || char(10) || 'ID: {transaction_id}',
 'transaction_id'),
('ping',
 '🏓 *PING WAHA*' || char(10) || char(10) || 'Waktu: {datetime}' || char(10) || char(10) || 'Pesan ini dikirim dari AbsenTray untuk menguji koneksi WhatsApp. Balasan (✅) berarti saluran berfungsi.',
 'datetime');

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
('polling_interval', '30000'),
('max_retry_attempts', '3'),
('device_timeout', '10000'),
('app_version', '1.0.0'),
('last_migration', '001_initial_schema.sql'),
('checkin_start', '00:00'),
('checkin_end', '11:59'),
('checkout_start', '12:00'),
('checkout_end', '23:59'),
('fingerprint_disable_before_read', '1'),
('device_log_retention_days', '30'),
('waha_message_delay_ms', '2000');

-- Create trigger for updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = datetime('now', '+7 hours') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_retry_queue_timestamp 
AFTER UPDATE ON retry_queue
BEGIN
    UPDATE retry_queue SET updated_at = datetime('now', '+7 hours') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_templates_timestamp 
AFTER UPDATE ON templates
BEGIN
    UPDATE templates SET updated_at = datetime('now', '+7 hours') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_schedules_timestamp 
AFTER UPDATE ON polling_schedules
BEGIN
    UPDATE polling_schedules SET updated_at = datetime('now', '+7 hours') WHERE id = NEW.id;
END;
