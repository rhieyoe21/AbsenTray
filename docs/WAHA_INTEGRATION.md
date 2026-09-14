# AbsenTray V2 - WAHA Integration Guide

## Overview

AbsenTray V2 integrates with **WAHA (WhatsApp HTTP API)** to send automated WhatsApp notifications for attendance events.

WAHA runs as a separate service: `http://192.168.1.180:5555`

## Setup WAHA

### 1. Install WAHA

```bash
# Using Docker (recommended)
docker pull devlikeapro/waha
docker run -d \
  --name waha \
  -p 3000:3000 \
  -p 5555:5555 \
  -v waha_data:/data \
  devlikeapro/waha
```

### 2. Access Dashboard

Navigate to: `http://192.168.1.180:3000`

### 3. Generate API Key

1. Go to Settings
2. Click "Generate API Key"
3. Copy the key
4. Add to AbsenTray `.env`:
   ```env
   WAHA_API_KEY=your_generated_key
   ```

### 4. Authenticate WhatsApp Session

1. In WAHA dashboard, click "Sessions"
2. Click "Add Session"
3. Scan QR code with WhatsApp on your phone
4. Wait for "WORKING" status

## API Endpoints

### Send Text Message

**Endpoint**: `POST /api/sendText`

**Headers**:
```
X-Api-Key: your_api_key
Content-Type: application/json
```

**Request Body**:
```json
{
  "session": "default",
  "chatId": "6281234567890@c.us",
  "text": "Hello, World!"
}
```

**Response**:
```json
{
  "id": "wamid.xxxxx",
  "timestamp": 1234567890
}
```

### Phone Number Format

Convert phone numbers to WhatsApp format:

| Input | Format | chatId |
|-------|--------|--------|
| 6281234567890 | International | `6281234567890@c.us` |
| 081234567890 | Local (Indonesia) | `6281234567890@c.us` |

**Conversion Rule**:
- Remove leading `0` if present
- Add country code `62` for Indonesia
- Append `@c.us` suffix

### Check Session Status

**Endpoint**: `GET /api/sessions/{session}/status`

**Response**:
```json
{
  "status": "WORKING",
  "messagesCount": 45,
  "lastActivity": "2026-09-13T11:25:00Z"
}
```

## Message Templates

### Attendance Notification

```
✅ *Presensi {mode}*
Nama: {name}
UID: {uid}
Hari: {date}
Jam: {time}
```

**Variables**:
- `{name}` - User name
- `{uid}` - User ID/UID
- `{date}` - Formatted date (e.g., "Jumat, 13 September 2026")
- `{time}` - Formatted time (e.g., "08:15:30")
- `{mode}` - Attendance mode ("Masuk" or "Pulang")

### Device Offline Alert

```
⚠️ *ALERT: Perangkat Fingerprint Offline*

IP: {ip}
Waktu: {datetime}

Mohon periksa koneksi perangkat!
```

**Variables**:
- `{ip}` - Device IP address
- `{datetime}` - Current timestamp

## Integration Flow

### 1. Attendance Event Occurs

User scans fingerprint on device → Log recorded

### 2. Backend Polls Device

Every 30 seconds, backend checks for new logs:
```bash
GET /device/logs
```

### 3. Process Attendance

- Fetch user details (name, WhatsApp number)
- Build message from template
- Check internet connection

### 4. Send WhatsApp Message

```bash
POST /api/sendText
{
  "session": "default",
  "chatId": "6281234567890@c.us",
  "text": "✅ *Presensi Masuk*\n..."
}
```

### 5. Handle Response

- **Success**: Save to database, mark as "sent"
- **Failure**: Add to retry queue

### 6. Retry Logic

Failed messages retry automatically:
- 1st retry: 1 minute later
- 2nd retry: 5 minutes later
- 3rd retry: 15 minutes later
- After 3 retries: Mark as failed, alert admin

## Testing

### Test API Connection

```bash
curl -X GET http://192.168.1.180:5555/api/sessions \
  -H "X-Api-Key: your_api_key"
```

### Send Test Message

```bash
curl -X POST http://192.168.1.180:5555/api/sendText \
  -H "X-Api-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "session": "default",
    "chatId": "6281234567890@c.us",
    "text": "Test message from AbsenTray"
  }'
```

### Via AbsenTray API

```bash
# Test WAHA connection
curl http://localhost:5000/api/settings/test-waha

# Send test message
curl -X POST http://localhost:5000/api/settings/test-send \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "6281234567890@c.us",
    "message": "Test from AbsenTray"
  }'
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Invalid API key | Regenerate key in WAHA dashboard |
| `404 Not Found` | Invalid session | Check session name in config |
| `400 Bad Request` | Invalid phone number | Verify format (6281234567890@c.us) |
| `429 Too Many Requests` | Rate limit | Reduce polling frequency |
| `503 Service Unavailable` | WAHA offline | Check WAHA service status |

### Retry on Failure

AbsenTray automatically retries failed messages:

```
Send attempt 1 ─→ [FAIL]
                    ↓
Wait 1 minute ─→ Send attempt 2 ─→ [FAIL]
                    ↓
Wait 5 minutes ─→ Send attempt 3 ─→ [FAIL]
                    ↓
Wait 15 minutes → Send attempt 4 ─→ [FAIL]
                    ↓
Alert admin → Mark as failed
```

## Troubleshooting

### WAHA Connection Refused

```bash
# Check if WAHA is running
curl http://192.168.1.180:5555/api/sessions

# If not running, start WAHA
docker start waha

# Or check logs
docker logs waha
```

### Message Not Sending

1. **Check internet**: `curl http://google.com`
2. **Verify WAHA**: `curl http://192.168.1.180:5555/health`
3. **Check API key**: Regenerate in dashboard
4. **Verify phone number**: Format must be `62812345678@c.us`
5. **Check logs**: `tail -f server/logs/app.log`

### Session Disconnected

1. Go to WAHA dashboard
2. Click "Reconnect"
3. Scan QR code again
4. Wait for "WORKING" status

### Rate Limiting

If hitting rate limits:

1. Reduce polling frequency (increase `POLLING_INTERVAL`)
2. Reduce number of concurrent users
3. Contact WAHA support for higher limits

## Best Practices

1. **API Key Security**
   - Rotate API keys monthly
   - Use `.env` for secrets
   - Never commit keys to Git

2. **Phone Number Format**
   - Always include country code (62 for Indonesia)
   - Remove leading 0 from local numbers
   - Use `@c.us` suffix

3. **Message Content**
   - Keep messages under 1000 characters
   - Use Unicode for Indonesian characters
   - Test messages before deployment

4. **Monitoring**
   - Monitor retry queue size
   - Check daily failed messages
   - Set up alerts for connection issues

5. **Backup Session**
   - Keep backup WhatsApp account
   - Regularly test session connectivity

## Limits & Quotas

- **Messages per day**: Depends on WhatsApp Business account
- **Rate limit**: Varies by account
- **Message size**: Max 1000 characters
- **Retry attempts**: Default 3 times
- **Sessions**: Currently 1 (single WhatsApp account)

## Next Steps

- [Configuration Guide](./CONFIGURATION.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [WAHA Official Docs](https://waha.devlike.pro)
