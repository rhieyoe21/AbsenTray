# AbsenTray V2 - Troubleshooting Guide

## Table of Contents

1. [Fingerprint Device Issues](#fingerprint-device-issues)
2. [WAHA Integration Issues](#waha-integration-issues)
3. [Database Issues](#database-issues)
4. [WhatsApp Message Issues](#whatsapp-message-issues)
5. [Server Issues](#server-issues)
6. [Frontend Issues](#frontend-issues)
7. [Performance Issues](#performance-issues)

---

## Fingerprint Device Issues

### Cannot Connect to Device

**Symptoms**:
- Log shows "Failed to connect"
- Dashboard shows device offline
- Alert sent to admin

**Solutions**:

1. **Check network connectivity**:
   ```bash
   ping 192.168.1.102
   ```
   
   If ping fails → Check LAN cable, device power, IP address

2. **Check port accessibility**:
   ```bash
   telnet 192.168.1.102 4370
   ```
   
   If telnet fails → Device may use different port or firewall blocking

3. **Verify device IP**:
   - Access device panel: `http://192.168.1.102:8080`
   - Check Network → TCP/IP settings
   - Verify static IP is correct

4. **Check connection in code**:
   ```bash
   curl http://localhost:5000/test-fingerprint
   ```

5. **Restart device**:
   - Power off/on the fingerprint device
   - Wait 30 seconds
   - Try connecting again

### Device Unlocks When Polling

ZKTeco devices lock during data read. Ensure `EnableDevice` is called after reading:
```javascript
// In fingerprint.service.js
await conn.enableDevice();  // Called after getAttendances
```

### No Attendance Logs Found

1. **Verify logs exist**:
   - Access device panel
   - Check Attendance → Logs
   - Ensure logs are being generated

2. **Check transaction ID format**:
   - Old system: `uid-timestamp`
   - New system: `uid-YYYYMMDDHHmmss`
   - Verify matching format

3. **Check duplicate prevention**:
   ```bash
   sqlite3 server/data/attendance.db "SELECT * FROM attendance WHERE DATE(attendance_time) = DATE('now')"
   ```

---

## WAHA Integration Issues

### Cannot Connect to WAHA

**Symptoms**:
- Log shows "WAHA request failed"
- Dashboard WAHA status offline

**Solutions**:

1. **Check WAHA service**:
   ```bash
   curl http://192.168.1.180:5555/api/sessions
   ```
   
   If fails → WAHA not running or wrong port

2. **Start WAHA**:
   ```bash
   docker start waha
   # or
   pm2 restart waha
   ```

3. **Check Docker logs**:
   ```bash
   docker logs waha --tail 50
   ```

4. **Verify network**:
   ```bash
   curl -v http://192.168.1.180:5555/health
   ```

### Authentication Failed

1. **Regenerate API key**:
   - Access WAHA dashboard: `http://192.168.1.180:3000`
   - Settings → API Keys → Generate new
   - Update in `.env`

2. **Verify key in request**:
   ```bash
   curl -X GET http://192.168.1.180:5555/api/sessions \
     -H "X-Api-Key: YOUR_KEY"
   ```

### Session Not Working

1. **Check session status**:
   ```bash
   curl http://192.168.1.180:5555/api/sessions/default
   ```
   
   Look for `"status": "WORKING"`

2. **Reconnect session**:
   - Dashboard → Sessions
   - Scan QR code again
   - Wait for connection

3. **Check phone connection**:
   - WhatsApp Web session on phone
   - Ensure phone has internet

### Telegram/WhatsApp Blocked

Follow WhatsApp best practices:
- Don't send too many messages quickly
- Space out sends (delay between messages)
- Use official WhatsApp Business account if possible

---

## Database Issues

### Database Locked

**Symptoms**:
- Log shows "SQLITE_BUSY"
- Operations fail

**Solutions**:

1. **Check for blocking processes**:
   ```bash
   fuser server/data/attendance.db
   ```

2. **Restart server**:
   ```bash
   pm2 restart absentray-api
   ```

3. **Enable WAL mode** (already configured):
   ```sql
   PRAGMA journal_mode=WAL;
   ```

### Database Corrupted

1. **Check integrity**:
   ```bash
   sqlite3 server/data/attendance.db "PRAGMA integrity_check;"
   ```

2. **Restore from backup**:
   ```bash
   cp server/backups/attendance_*.db server/data/attendance.db
   ```

3. **Start fresh** (lose data):
   ```bash
   rm server/data/attendance.db
   npm run db:init
   ```

### Schema Mismatch

If error shows table doesn't exist:
```bash
# Verify current schema
sqlite3 server/data/attendance.db ".schema"

# Reinitialize
npm run db:init
```

---

## WhatsApp Message Issues

### Message Not Sent

1. **Check retry queue**:
   ```bash
   curl http://localhost:5000/api/dashboard/retry-queue
   ```

2. **Verify phone number format**:
   ```
   Wrong:  081234567890
   Correct: 6281234567890@c.us
   ```

3. **Check user mapping**:
   ```bash
   sqlite3 server/data/attendance.db "SELECT * FROM users WHERE whatsapp_number = '6281234567890'"
   ```

### Duplicate Messages

1. **Check transaction ID**: Each attendance should have unique ID:
   ```
   Format: {uid}-{YYYYMMDDHHmmss}
   Example: 827305001-20260913081530
   ```

2. **Check database**:
   ```bash
   sqlite3 server/data/attendance.db \
     "SELECT transaction_id, COUNT(*) FROM attendance GROUP BY transaction_id HAVING COUNT(*) > 1;"
   ```

### Delayed Messages

1. **Check polling interval**:
   - Default: 30 seconds
   - Increase means more delay

2. **Check retry attempts**:
   - Each retry waits: 1min, 5min, 15min

### Message Format Wrong

Verify template in database:
```bash
curl http://localhost:5000/api/templates
```

Test preview:
```bash
curl -X POST http://localhost:5000/api/templates/preview \
  -H "Content-Type: application/json" \
  -d '{"templateName": "attendance_notification"}'
```

---

## Server Issues

### Server Won't Start

1. **Check Node.js version**:
   ```bash
   node --version
   # Should be >= 18
   ```

2. **Check port conflict**:
   ```bash
   # Find what's on port 5000
   lsof -i :5000
   # Kill and restart
   pm2 restart absentray-api
   ```

3. **Check environment file**:
   ```bash
   node -e "require('dotenv').config(); console.log(process.env.PORT)"
   ```

### High CPU Usage

1. **Reduce polling frequency**:
   ```env
   POLLING_INTERVAL=60000  # From 30000
   ```

2. **Check infinite loops**:
   ```bash
   pm2 monit
   ```

3. **Limit concurrent connections**:
   Adjust `socket.io` server configuration

### Memory Leaks

1. **Restart periodically**:
   ```bash
   pm2 restart absentray-api --max-memory-restart 512M
   ```

2. **Monitor usage**:
   ```bash
   pm2 monit
   # or
   node -e "console.log(process.memoryUsage())"
   ```

---

## Frontend Issues

### Page Won't Load

1. **Check frontend server**:
   ```bash
   curl http://localhost:3000
   ```

2. **Check API connection**:
   ```bash
   curl http://localhost:5000/api/dashboard/stats
   ```

3. **Browser developer tools**:
   - F12 → Console
   - F12 → Network
   - Look for failed requests

### WebSocket Connection Failed

1. **Check socket endpoint**:
   ```javascript
   // .env
   VITE_WS_URL=ws://localhost:5000
   ```

2. **Check proxy config** (vite.config.js):
   ```javascript
   '/socket.io': {
     target: 'ws://localhost:5000',
     ws: true,
   }
   ```

3. **Check browser console** for `socket.io-client` errors

### Dark/Light Mode Not Working

1. **Clear localStorage**:
   ```javascript
   localStorage.clear()  // In browser console
   ```

2. **Check theme store**:
   - `client/src/store/themeStore.js`
   - `document.documentElement.setAttribute('data-theme', theme)`

### Charts Not Showing

1. **Check chart data**:
   ```bash
   curl http://localhost:5000/api/dashboard/charts
   ```

2. **Check Chart.js dependencies**:
   ```bash
   cd client && npm list chart.js react-chartjs-2
   ```

---

## Performance Issues

### Slow Polling

1. **Increase interval**: Default 30s
2. **Limit log size**: Clean old attendance records:
   ```sql
   DELETE FROM attendance WHERE attendance_time < date('now', '-6 months');
   ```
3. **Optimize indexes**: Already in migration

### Large Database

1. **Archive old records**:
   ```sql
   -- Copy to archive table
   CREATE TABLE attendance_archive AS 
     SELECT * FROM attendance WHERE attendance_time < date('now', '-1 year');
   -- Delete old records
   DELETE FROM attendance WHERE attendance_time < date('now', '-1 year');
   ```

2. **VACUUM**:
   ```bash
   sqlite3 server/data/attendance.db "VACUUM"
   ```

### Slow Frontend

1. **Reduce auto-refresh intervals**:
   ```js
   // in components
   refetchInterval: 60000  // From 30000
   ```

2. **Optimize bundle**:
   ```bash
   cd client && npm run build
   # Serves optimized static files
   ```

---

## Common Error Messages

### "Too many requests from this IP"

Rate limit exceeded. Wait 15 minutes or increase limit:
```js
// middleware/rateLimit.js
max: 500  // Increase from 100
```

### "SQLITE_CONSTRAINT"

Duplicate record (usually UID or transaction ID). The system is working correctly - this prevents duplicates.

### "ECONNREFUSED"

Connection refused. Check:
- Fingerprint device: `ping 192.168.1.102`
- WAHA: `curl http://192.168.1.180:5555`

### "ETIMEDOUT"

Request timed out. Check:
- Network speed
- Firewall rules
- Device responsiveness

---

## Diagnostic Commands

### Quick Health Check

```bash
# Server
curl http://localhost:5000/health

# Fingerprint device
curl http://localhost:5000/test-fingerprint

# WAHA
curl http://localhost:5000/test-waha

# Database
curl http://localhost:5000/test-db
```

### Log Analysis

```bash
# All logs
tail -f server/logs/app.log

# Errors only
grep "ERROR" server/logs/app.log | tail -50

# WAHA related
grep "WAHA\|whatsapp" server/logs/app.log | tail -50

# Device related
grep "fingerprint\|device" server/logs/app.log | tail -50
```

---

## Support Checklist

Before creating an issue, verify:
1. All services running (`pm2 list`)
2. `.env` correctly configured
3. Latest dependencies installed (`npm install`)
4. Full system restart (`pm2 restart all`)
5. Read relevant documentation sections

If issue persists, gather:
```
1. Full error message
2. Node version: node --version
3. Logs: tail -n 200 server/logs/app.log
4. Config (without API keys)
5. Steps to reproduce
6. Expected vs actual behavior
```