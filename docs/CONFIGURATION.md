# AbsenTray V2 - Configuration Guide

## Environment Variables

### Server Configuration

#### Database

```env
DB_PATH=./data/attendance.db
```

Location where SQLite database file is stored.

#### Fingerprint Device

```env
FINGERPRINT_IP=192.168.1.102
FINGERPRINT_PORT=4370
FINGERPRINT_TIMEOUT=10000
POLLING_INTERVAL=30000
```

- **IP**: Device IP address on network
- **PORT**: Device listening port (default: 4370)
- **TIMEOUT**: Connection timeout in milliseconds
- **POLLING_INTERVAL**: How often to poll for new attendance logs (milliseconds)

#### WAHA Integration

```env
WAHA_URL=http://192.168.1.180:5555
WAHA_API_KEY=your_api_key_here
WAHA_SESSION=default
```

- **URL**: WAHA server address
- **API_KEY**: Authentication key from WAHA dashboard
- **SESSION**: WhatsApp session name (default: "default")

#### Admin Settings

```env
ADMIN_WHATSAPP=628XXXXXXXXXX
```

WhatsApp number for receiving admin alerts (device offline, send failures, etc.)

#### Logging

```env
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

- **LEVEL**: info, warn, error, debug
- **FILE**: Log file location

#### CORS

```env
CLIENT_URL=http://localhost:3000
```

Allowed origin for frontend requests.

## Database Configuration

### SQLite

AbsenTray V2 uses SQLite3 by default. No additional setup required.

#### Location

- Development: `server/data/attendance.db`
- Production: Specify via `DB_PATH` environment variable

#### Backups

Manual backup:
```bash
cp server/data/attendance.db server/data/attendance.backup.db
```

Automated (runs weekly on Sunday at 3 AM):
```
server/backups/attendance_2026-09-13T*.db
```

## Fingerprint Device Configuration

### Device Setup

1. **Access Device Admin Panel**
   - Connect to device web interface
   - Default: `http://192.168.1.102:8080` (may vary)

2. **Configure WAHA Integration**
   - Choose protocol: **TCP** (recommended) or UDP
   - Set server address to your Ubuntu server IP
   - Verify connectivity

3. **Test Connection**
   ```bash
   curl http://localhost:5000/test-fingerprint
   ```

### Polling Configuration

Default: Every 30 seconds

Adjust in `.env`:
```env
POLLING_INTERVAL=60000  # Change to 60 seconds
```

## WAHA Configuration

### API Key Generation

1. Open WAHA Dashboard: `http://192.168.1.180:3000`
2. Navigate to Settings
3. Generate new API key
4. Copy and paste to `.env`:
   ```env
   WAHA_API_KEY=your_generated_key
   ```

### Session Management

Default session name: `default`

For multiple WhatsApp accounts:
```env
WAHA_SESSION=employee_1
```

### Test API Connection

```bash
curl -X POST http://192.168.1.180:5555/api/sendText \
  -H "X-Api-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "session": "default",
    "chatId": "628xxxxxxxxxx@c.us",
    "text": "Test message"
  }'
```

## Message Templates

### Default Templates

Templates are stored in database. Access via API:

```bash
curl http://localhost:5000/api/templates
```

### Create Custom Template

```bash
curl -X POST http://localhost:5000/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "custom_notification",
    "content": "Custom message {name} {uid}",
    "variables": "name,uid"
  }'
```

## Retry Configuration

```env
MAX_RETRY_ATTEMPTS=3
RETRY_DELAYS=60000,300000,900000  # 1min, 5min, 15min
```

Retry schedule:
- Attempt 1: Immediate
- Attempt 2: 1 minute later
- Attempt 3: 5 minutes later
- Attempt 4: 15 minutes later
- After 4 attempts: Mark as failed, alert admin

## Monitoring & Logging

### Log Files

```
server/logs/
├── app.log          # General application logs
├── access.log       # HTTP access logs
└── error.log        # Error-specific logs
```

### Log Level

Set in `.env`:
```env
LOG_LEVEL=debug  # Most verbose
LOG_LEVEL=info   # Standard
LOG_LEVEL=warn   # Warnings only
LOG_LEVEL=error  # Errors only
```

### View Logs

```bash
# Real-time logs
tail -f server/logs/app.log

# Last 100 lines
tail -n 100 server/logs/app.log

# Search logs
grep "ERROR" server/logs/app.log
```

### Log Rotation

Logs rotate automatically when exceeding 10MB.

Old logs: `server/logs/app.log.2026-09-13T12-34-56-789Z`

## Performance Tuning

### Database Optimization

```bash
# Optimize database
sqlite3 server/data/attendance.db "VACUUM;"
```

### Connection Pooling

Currently set to max 1 fingerprint connection (required by device).

### Polling Optimization

Increase polling interval if high CPU usage:
```env
POLLING_INTERVAL=60000  # Poll every 60 seconds instead of 30
```

## Security Considerations

1. **API Keys**: Store securely in `.env`, never commit
2. **Database**: Keep `data/` directory with restricted permissions
3. **Logs**: May contain sensitive data, restrict access
4. **WhatsApp Numbers**: Phone numbers are logged, be careful with PII
5. **CORS**: Restrict `CLIENT_URL` to known domains in production

## Production Deployment

### Environment

```env
NODE_ENV=production
PORT=5000
LOG_LEVEL=warn
```

### Database Backup

Setup automated daily backups:
```bash
# Add to crontab
0 2 * * * cp /path/to/attendance.db /backup/attendance_$(date +\%Y\%m\%d).db
```

### SSL/TLS

Use Nginx reverse proxy with SSL:
```nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;
    
    location / {
        proxy_pass http://localhost:5000;
    }
}
```

### Monitoring

Setup health checks:
```bash
*/5 * * * * curl -f http://localhost:5000/health || alert_admin
```

## Troubleshooting Configuration

### Device Connection Issues

```bash
# Check if device is reachable
ping 192.168.1.102

# Test TCP connection
telnet 192.168.1.102 4370

# Check logs
tail -f server/logs/app.log | grep "fingerprint"
```

### WAHA Issues

```bash
# Test WAHA health
curl http://192.168.1.180:5555/api/sessions

# Check API key
curl -H "X-Api-Key: WRONG_KEY" http://192.168.1.180:5555/api/sessions
```

### Database Locked

```bash
# Kill other connections
pkill -f "sqlite.*attendance.db"

# Restart server
npm restart
```

## Next Steps

- [API Documentation](./API.md)
- [WAHA Integration](./WAHA_INTEGRATION.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
