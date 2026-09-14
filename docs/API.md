# AbsenTray V2 - API Documentation

## Base URL

All API endpoints are relative to: `http://localhost:5000/api`

## Response Format

### Success

```json
{
  "success": true,
  "data": { ... }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "status": 404,
    "message": "Resource not found",
    "timestamp": "2026-09-13T12:00:00.000Z"
  }
}
```

## Authentication

No authentication required for local API access (same network).
For production, set up rate limiting and IP allowlist.

## Rate Limiting

Default limit: **100 requests per 15 minutes per IP**.

When exceeded:
```json
{
  "success": false,
  "error": "Too many requests from this IP, please try again later."
}
```

---

## Health Endpoints

### `GET /health`

Check server health status.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-09-13T12:00:00.000Z",
  "version": "1.0.0",
  "environment": "development"
}
```

### `GET /test-db`

Test database connection.

### `GET /test-fingerprint`

Test fingerprint device connection.

**Response**:
```json
{
  "success": true,
  "data": {
    "connected": true,
    "device": {
      "ip": "192.168.1.102",
      "port": 4370
    }
  }
}
```

### `GET /test-waha`

Test WAHA connection.

---

## Attendance Endpoints

### `GET /api/attendance`

Get all attendance records.

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | string | Filter by date (YYYY-MM-DD) |
| `userId` | string | Filter by user ID |
| `status` | string | Filter by status (pending/sent/failed) |
| `limit` | number | Max records (default: 100) |
| `offset` | number | Pagination offset (default: 0) |

**Example Request**:
```bash
curl "http://localhost:5000/api/attendance?date=2026-09-13&limit=10"
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "transaction_id": "827305001-20260913081530",
      "user_id": "827305001",
      "user_name": "ABDUS SYUKUR",
      "whatsapp_number": "628XXXXXXXXXX",
      "attendance_time": "2026-09-13T08:15:30.000Z",
      "mode": "Masuk",
      "status": "sent",
      "sent_at": "2026-09-13T08:15:31.000Z"
    }
  ],
  "pagination": {
    "total": 1000,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

### `GET /api/attendance/stats/today`

Get today's attendance statistics.

**Response**:
```json
{
  "success": true,
  "date": "today",
  "stats": {
    "total": 45,
    "byMode": [
      { "mode": "Masuk", "count": 23 },
      { "mode": "Pulang", "count": 22 }
    ],
    "byStatus": [
      { "status": "sent", "count": 45 }
    ],
    "hourly": [
      { "hour": "08", "count": 5 },
      { "hour": "09", "count": 10 }
    ]
  }
}
```

### `GET /api/attendance/date/:date`

Get records for specific date.

### `POST /api/attendance/manual`

Create manual attendance record.

**Request Body**:
```json
{
  "userId": "827305001",
  "mode": "Masuk",
  "timestamp": "2026-09-13T09:30:00.000Z"
}
```

---

## User Endpoints

### `GET /api/users`

Get all users.

**Query Parameters**:
- `search` - Search by name, UID, or WhatsApp number
- `limit` - Page size (default: 25)
- `offset` - Page offset

### `GET /api/users/:uid`

Get single user by UID.

### `POST /api/users`

Create new user.

**Request Body**:
```json
{
  "uid": "827305001",
  "name": "ABDUS SYUKUR",
  "whatsapp_number": "628XXXXXXXXXX"
}
```

### `PUT /api/users/:uid`

Update user information.

**Request Body** (any subset):
```json
{
  "name": "ABDUS SYUKUR (UPDATED)",
  "whatsapp_number": "6281234567890"
}
```

### `DELETE /api/users/:uid`

Soft-delete a user (sets is_active=0).

### `POST /api/users/import`

Import users from CSV file.

**Request Body**:
```json
{
  "filePath": "/path/to/map_user.csv"
}
```

CSV format:
```
uid,name,wa
827305001,ABDUS SYUKUR,628XXXXXXXXXX
```

### `GET /api/users/export`

Export all users to CSV.

**Response**: CSV file download:
```
uid,name,whatsapp_number
827305001,ABDUS SYUKUR,628XXXXXXXXXX
```

---

## Template Endpoints

### `GET /api/templates`

Get all message templates.

### `GET /api/templates/:id`

Get single template by ID.

### `GET /api/templates/name/:name`

Get template by name.

### `POST /api/templates`

Create a new template.

**Request Body**:
```json
{
  "name": "attendance_notification",
  "content": "✅ *Presensi {mode}*\nNama: {name}\nUID: {uid}\nHari: {date}\nJam: {time}",
  "variables": "name,uid,date,time,mode"
}
```

### `PUT /api/templates/:id`

Update a template.

### `DELETE /api/templates/:id`

Soft-delete a template.

### `POST /api/templates/preview`

Preview a rendered template.

**Request Body**:
```json
{
  "templateName": "attendance_notification",
  "variables": {
    "name": "John Doe",
    "uid": "827305001",
    "date": "Jumat, 13 September 2026",
    "time": "08:15:30",
    "mode": "Masuk"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "template": "✅ *Presensi {mode}*...",
    "variables": { ... },
    "rendered": "✅ *Presensi Masuk*\nNama: John Doe\nUID: 827305001..."
  }
}
```

---

## Dashboard Endpoints

### `GET /api/dashboard/stats`

Get overall dashboard statistics.

**Response**:
```json
{
  "success": true,
  "data": {
    "attendance": {
      "total": 45,
      "byMode": [...],
      "byStatus": [...],
      "hourly": [...]
    },
    "retryQueue": { "pending": 0 },
    "device": {
      "deviceOnline": true,
      "pollingEnabled": true,
      "pollingInterval": 30000,
      "lastPollTime": "2026-09-13T12:00:00.000Z"
    },
    "waha": { "connected": true },
    "scheduler": {
      "running": true,
      "jobsCount": 5
    }
  }
}
```

### `GET /api/dashboard/recent?limit=20`

Get recent attendance activities.

### `GET /api/dashboard/charts`

Get chart data (hourly, by mode, by status).

### `GET /api/dashboard/device-status`

Get fingerprint device status + recent device logs.

### `GET /api/dashboard/retry-queue`

Get pending retry queue items.

---

## Settings Endpoints

### `GET /api/settings`

Get current system settings.

### `PUT /api/settings`

Update settings.

**Request Body**:
```json
{
  "settings": {
    "polling_interval": "60000",
    "max_retry_attempts": "5"
  }
}
```

### `POST /api/settings/test-waha`

Test WAHA connection.

### `POST /api/settings/test-fingerprint`

Test fingerprint device.

### `POST /api/settings/test-send`

Send test WhatsApp message.

**Request Body**:
```json
{
  "chatId": "6281234567890@c.us",
  "message": "Test message from AbsenTray"
}
```

---

## Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `ValidationError` | Invalid input data |
| 401 | `Unauthorized` | Missing/invalid authentication |
| 404 | `NotFound` | Resource does not exist |
| 409 | `DuplicateEntry` | Duplicate record (e.g., UID exists) |
| 429 | `RateLimitExceeded` | Too many requests |
| 500 | `InternalError` | Server error |
| 503 | `ServiceUnavailable` | External service unavailable |

## WebSocket Events

### Connection

```javascript
const socket = io('ws://localhost:5000', {
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});
```

### Events Emitted

| Event | Description | Payload |
|-------|-------------|---------|
| `attendance:new` | New attendance recorded | `{ transactionId, userName, mode, time, status }` |
| `device:offline` | Device went offline | `{ ip, error }` |
| `device:recovered` | Device back online | `{ ip }` |
| `retry:sent` | Retry message sent | `{ retryId }` |
| `retry:exhausted` | Retry attempts exhausted | `{ retryId }` |

### Client Events

| Event | Description |
|-------|-------------|
| `disconnect` | Client disconnected |
| `ping` | Client heartbeat |