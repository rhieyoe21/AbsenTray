# AbsenTray V2 - Main README

## 🔔 AbsenTray V2

Real-time Attendance Monitoring System with WhatsApp Notifications

**Technology Stack**: Node.js + React + SQLite + WAHA API + ZKTeco Fingerprint

---

## 📋 Features

✅ **Real-time Attendance Monitoring**
- Automatic polling of ZKTeco fingerprint devices
- Instant WhatsApp notifications
- Support for multiple attendance modes (Masuk/Pulang)

✅ **WhatsApp Integration**
- WAHA (WhatsApp HTTP API) integration
- Customizable message templates
- Automatic retry mechanism for failed messages

✅ **User Management**
- Import/export user profiles (CSV)
- Map UID to WhatsApp numbers
- Bulk user operations

✅ **Dashboard & Monitoring**
- Real-time attendance charts
- Live activity feed
- Device status monitoring
- System health checks

✅ **Robust Backend**
- SQLite database with automatic backups
- Retry queue for failed messages
- Admin alerts for system issues
- Comprehensive logging

✅ **Modern Frontend**
- React 18 with Vite
- Responsive design with TailwindCSS
- Dark/Light mode toggle
- Real-time WebSocket updates

---

## 🚀 Quick Start

### Requirements

- Node.js 18+ 
- npm 8+
- Ubuntu 20.04+ (for server deployment)
- WAHA running on `http://192.168.100.180:5555`

### Installation

```bash
# Clone repository
git clone <repo-url> AbsenTrayV2
cd AbsenTrayV2

# Backend setup
cd server
cp .env.example .env
# Edit .env with your config
npm install
npm run db:init
npm run import:users
npm run dev

# Frontend setup (in new terminal)
cd client
cp .env.example .env
npm install
npm run dev
```

### Access Application

- **Frontend**: http://localhost:3000
- **API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

---

## 📚 Documentation

- [Installation Guide](./docs/INSTALLATION.md)
- [Configuration Guide](./docs/CONFIGURATION.md)
- [API Documentation](./docs/API.md)
- [WAHA Integration](./docs/WAHA_INTEGRATION.md)
- [Migration Guide](./docs/MIGRATION.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)

---

## 🏗️ Project Structure

```
AbsenTrayV2/
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── services/      # Business logic
│   │   ├── controllers/   # API endpoints
│   │   ├── models/        # Data models
│   │   ├── routes/        # API routes
│   │   ├── middleware/    # Express middleware
│   │   └── utils/         # Utilities
│   ├── migrations/        # Database schemas
│   ├── scripts/           # Utility scripts
│   ├── data/             # SQLite database
│   ├── logs/             # Application logs
│   ├── .env.example      # Environment template
│   └── package.json
│
├── client/                # React frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── hooks/        # Custom hooks
│   │   ├── store/        # State management
│   │   ├── services/     # API client
│   │   ├── utils/        # Utilities
│   │   └── App.jsx
│   ├── .env.example      # Environment template
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── docs/                  # Documentation
│   ├── INSTALLATION.md
│   ├── CONFIGURATION.md
│   ├── API.md
│   ├── WAHA_INTEGRATION.md
│   ├── MIGRATION.md
│   └── TROUBLESHOOTING.md
│
└── README.md
```

---

## 🔧 Configuration

Copy `.env.example` to `.env` and configure:

**Server (.env)**:
```env
# Fingerprint Device
FINGERPRINT_IP=192.168.100.102
FINGERPRINT_PORT=4370
POLLING_INTERVAL=30000

# WAHA Integration
WAHA_URL=http://192.168.100.180:5555
WAHA_API_KEY=your_key_here

# Admin Settings
ADMIN_WHATSAPP=6281367675539
```

**Client (.env)**:
```env
VITE_API_URL=http://localhost:5000/api
VITE_WS_URL=ws://localhost:5000
```

---

## 📊 Dashboard

### Available Pages

- **Dashboard**: Real-time statistics, attendance charts, recent activities
- **Users**: User management, CSV import/export
- **Templates**: Message template management
- **Monitoring**: Live logs, device status, retry queue
- **Settings**: System configuration, connection tests

### Features

- 📈 Real-time charts (bar, pie)
- 📱 Responsive mobile design
- 🌙 Dark/Light mode
- 🔄 Live updates via WebSocket
- 📊 Attendance statistics

---

## 🔌 API Endpoints

### Attendance

- `GET /api/attendance` - Get all attendance records
- `GET /api/attendance/stats/today` - Today's statistics
- `GET /api/attendance/date/:date` - Records by date
- `POST /api/attendance/manual` - Manual attendance entry

### Users

- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PUT /api/users/:uid` - Update user
- `POST /api/users/import` - Import from CSV
- `GET /api/users/export` - Export to CSV

### Templates

- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `PUT /api/templates/:id` - Update template
- `POST /api/templates/preview` - Preview rendered template

### Dashboard

- `GET /api/dashboard/stats` - Statistics
- `GET /api/dashboard/recent` - Recent activities
- `GET /api/dashboard/charts` - Chart data
- `GET /api/dashboard/device-status` - Device status

### Settings

- `GET /api/settings` - Current settings
- `PUT /api/settings` - Update settings
- `POST /api/settings/test-waha` - Test WAHA connection
- `POST /api/settings/test-fingerprint` - Test device connection

---

## 🔄 Data Migration

### From Old System

```bash
cd server

# Copy old data files
cp /path/to/map_user.csv .
cp /path/to/sent_log.txt .

# Run migrations
npm run import:users
npm run migrate:sent-logs
```

### What Gets Migrated

- **Users**: Imported from `map_user.csv`
- **Sent Logs**: Transaction IDs marked as already sent
- **Settings**: Preserved from old configuration

---

## 📝 Database

### SQLite Location

- Development: `server/data/attendance.db`
- Production: Configure via `DB_PATH`

### Tables

- `users` - Employee profiles
- `attendance` - Attendance records
- `retry_queue` - Failed messages awaiting retry
- `templates` - WhatsApp message templates
- `settings` - System configuration
- `device_logs` - Device connection logs

### Backups

- Manual: `cp server/data/attendance.db backup.db`
- Automatic: Weekly Sunday 3 AM

---

## 🚀 Production Deployment

### Using PM2

```bash
cd server
pm2 start server.js --name absentray-api
pm2 start ../client/node_modules/.bin/vite -- --host 0.0.0.0

pm2 save
pm2 startup
```

### Using Docker

```bash
docker build -t absentray-v2 .
docker run -d -p 5000:5000 -p 3000:3000 \
  -e WAHA_API_KEY=your_key \
  -v $(pwd)/data:/app/data \
  absentray-v2
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api {
        proxy_pass http://localhost:5000;
    }

    location / {
        proxy_pass http://localhost:3000;
    }
}
```

---

## 🧪 Testing

### Test Endpoints

```bash
# Health check
curl http://localhost:5000/health

# Test database
curl http://localhost:5000/test-db

# Test fingerprint device
curl http://localhost:5000/test-fingerprint

# Test WAHA connection
curl http://localhost:5000/test-waha
```

---

## 📋 Requirements Met

✅ Node.js + Express backend
✅ React 18 frontend with Vite
✅ SQLite database
✅ Dark/Light mode toggle
✅ Real-time WebSocket updates
✅ WAHA WhatsApp API integration
✅ ZKTeco fingerprint device polling
✅ User import/export (CSV)
✅ Admin alerts
✅ Comprehensive logging
✅ Retry mechanism
✅ Device offline detection
✅ Dashboard with charts
✅ Message template management

---

## 🆘 Support

### Troubleshooting

See [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) for common issues.

### Logs

```bash
# Backend logs
tail -f server/logs/app.log

# Real-time monitoring
tail -f server/logs/app.log | grep ERROR
```

### Health Checks

All services support health endpoints:
- Backend: `http://localhost:5000/health`
- WAHA: `http://192.168.100.180:5555/api/sessions`
- Frontend: `http://localhost:3000` (responds with HTML)

---

## 📄 License

MIT License - Feel free to use and modify

---

## 👥 Credits

Built with ❤️ for AbsensiX105

**Tech Stack**: Node.js, Express, React, SQLite, WAHA, ZKTeco SDK, TailwindCSS, DaisyUI

---

**Last Updated**: September 13, 2026

For more details, see the complete [documentation](./docs/).
