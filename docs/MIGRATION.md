# AbsenTray V2 - Migration Guide

## Overview

This guide covers migrating from the old AbsenTray (C# Windows Forms) to the new AbsenTray V2 (Node.js + React).

## What's Migrated

| Data | Old Format | New Format | Tool |
|------|-----------|------------|------|
| Users | `map_user.csv` | `users` table | `import-users.js` |
| Sent Logs | `sent_log.txt` | `attendance` table | `migrate-sent-logs.js` |
| Config | `config.json` | `.env` file | Manual |

## Prerequisites

1. Create backup of old system files:
   ```bash
   cp /path/to/AbsenTray/map_user.csv /path/to/backup/
   cp /path/to/AbsenTray/sent_log.txt /path/to/backup/
   cp /path/to/AbsenTray/config.json /path/to/backup/
   ```

2. Verify files exist:
   ```bash
   ls -la map_user.csv
   ls -la sent_log.txt
   ```

## Step 1: Install New System

```bash
cd AbsenTrayV2/server
npm install
cp .env.example .env
```

## Step 2: Initialize Database

```bash
npm run db:init
```

Expected output:
```
Tables created successfully:
  - users: 0 records
  - attendance: 0 records
  - retry_queue: 0 records
  - templates: 3 records
  - settings: 5 records
  - device_logs: 0 records
```

## Step 3: Import Users from CSV

Copy `map_user.csv` to current directory:
```bash
cp /path/to/backup/map_user.csv .
```

Run import:
```bash
npm run import:users
```

Expected output:
```
📊 Found 4 users in CSV

  1. ✅ ADDED: ABDUS SYUKUR (827305001)
  2. ✅ ADDED: ECIH SUHERSIH (827305003)
  3. ✅ ADDED: NURLAELAH (827312005)
  4. ✅ ADDED: FAKHRI AULIA (827316006)

📊 Import Summary:
  ✅ Imported: 4 users
  ⏭️  Skipped: 0 users (duplicates/errors)
```

## Step 4: Migrate Sent Logs

Copy `sent_log.txt` to current directory:
```bash
cp /path/to/backup/sent_log.txt .
```

Run migration:
```bash
npm run migrate:sent-logs
```

## Step 5: Configure Environment

Edit `.env`:
```env
# Old config.json values
FINGERPRINT_IP=192.168.1.102  # New device IP
FINGERPRINT_PORT=4370

# WAHA settings
WAHA_URL=http://192.168.1.180:5555
WAHA_API_KEY=<your_key>
ADMIN_WHATSAPP=628XXXXXXXXXX
```

## Step 6: Verify Migration

### Check users in database

```bash
curl http://localhost:5000/api/users
```

Expected:
```json
{
  "success": true,
  "data": [
    { "uid": "827305001", "name": "ABDUS SYUKUR", "whatsapp_number": "628XXXXXXXXXX" },
    ...
  ],
  "pagination": { "total": 4 }
}
```

### Test attendance flow

1. Scan fingerprint on device
2. Wait for polling cycle (~30 seconds)
3. Check recent activities: `curl http://localhost:5000/api/dashboard/recent`
4. Verify WhatsApp message received

## Step 7: Decommission Old System

After verifying new system works:

1. Stop old AbsenTray:
   - Right-click tray icon → "Keluar"
   - Or `taskkill /f /im AbsenTray.exe`

2. Remove old files from startup:
   ```bash
   # Remove from Windows startup folder
   rm -rf "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup\AbsenTray.lnk"
   ```

## Rollback Procedure

If migration fails, you can revert:

1. **Data**: Restore from backup:
   ```bash
   cp /path/to/backup/attendance.backup.db server/data/attendance.db
   ```

2. **Users**: Re-import:
   ```bash
   npm run import:users
   ```

3. **Old System**: Restart AbsenTray.exe on old machine

## Data Validation Checklist

- [ ] All users imported (compare counts)
- [ ] WhatsApp numbers correct format (628...)
- [ ] No duplicate UIDs
- [ ] Attendance records marked as "sent"
- [ ] No data loss in sent_log.txt
- [ ] Device connection works
- [ ] WAHA connection works
- [ ] Test WhatsApp message arrives
- [ ] Dashboard shows correct stats

## Troubleshooting

### Import Failed: File not found

```bash
ls -la map_user.csv
# If not found, copy from backup
cp /path/to/backup/map_user.csv .
```

### Database Already Has Data

```bash
# Check current counts
sqlite3 server/data/attendance.db "SELECT COUNT(*) FROM users;"

# Or reset database
rm server/data/attendance.db
npm run db:init
```

### Duplicate Users

The import script uses `INSERT OR IGNORE`, so duplicate UIDs are automatically skipped.

### Missing Attendance Data

Old system didn't store attendance data in database - only sent_log.txt. 
To maintain history, entries in sent_log.txt are marked as "sent" without detailed timestamps.