# AbsenTray V2 - Installation Guide

## Prerequisites

- **Node.js**: 18 LTS or higher
- **npm**: 8.0 or higher
- **Ubuntu/Linux**: 20.04 or higher (for server)
- **SQLite 3**: Pre-installed on most systems
- **WAHA**: WhatsApp HTTP API server running on `http://192.168.1.180:5555`

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url> AbsenTrayV2
cd AbsenTrayV2
```

### 2. Backend Setup

```bash
cd server

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env  # or use your preferred editor
```

#### Configure .env

```env
NODE_ENV=development
PORT=5000
HOST=0.0.0.0

# Database
DB_PATH=./data/attendance.db

# Fingerprint Device
FINGERPRINT_IP=192.168.1.102
FINGERPRINT_PORT=4370
FINGERPRINT_TIMEOUT=10000
POLLING_INTERVAL=30000

# WAHA Configuration
WAHA_URL=http://192.168.1.180:5555
WAHA_API_KEY=your_api_key_here
WAHA_SESSION=default

# Admin Alert
ADMIN_WHATSAPP=628XXXXXXXXXX

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# CORS
CLIENT_URL=http://localhost:3000
```

#### Initialize Database

```bash
# Install dependencies
npm install

# Initialize database schema
npm run db:init

# Import existing users from map_user.csv
npm run import:users

# Migrate sent logs from sent_log.txt
npm run migrate:sent-logs
```

#### Start Backend Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

Backend will run on: `http://localhost:5000`

### 3. Frontend Setup

```bash
cd ../client

# Copy environment template
cp .env.example .env

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will run on: `http://localhost:3000`

## Running Both Services

### Terminal 1: Backend

```bash
cd server
npm run dev
```

### Terminal 2: Frontend

```bash
cd client
npm run dev
```

Then open `http://localhost:3000` in your browser.

## Testing Connections

### Test Database Connection

```bash
curl http://localhost:5000/test-db
```

### Test Fingerprint Device

```bash
curl http://localhost:5000/test-fingerprint
```

### Test WAHA Connection

```bash
curl http://localhost:5000/test-waha
```

## File Locations

### Backend

- **Database**: `server/data/attendance.db`
- **Logs**: `server/logs/app.log`
- **Config**: `server/.env`

### Frontend

- **Config**: `client/.env`
- **Build**: `client/dist/` (after `npm run build`)

## Troubleshooting

### Database Connection Error

```bash
# Reinitialize database
cd server
npm run db:init
```

### Port Already in Use

Change port in `.env`:
```env
PORT=5001
```

Then restart the server.

### WAHA Connection Failed

1. Verify WAHA is running on port 5555
2. Check API key in `.env`
3. Test connection: `curl -H "X-Api-Key: YOUR_KEY" http://192.168.1.180:5555/api/sessions`

### Fingerprint Device Unreachable

1. Verify device IP: `ping 192.168.1.102`
2. Check network connectivity
3. Verify device is powered on and connected

## Migration from Old System

```bash
cd server

# Copy old files to current directory
cp /path/to/old/map_user.csv .
cp /path/to/old/sent_log.txt .

# Run migrations
npm run import:users
npm run migrate:sent-logs

# Verify migration
npm run db:init  # Reinit to see counts
```

## Next Steps

- [Configuration Guide](./CONFIGURATION.md)
- [API Documentation](./API.md)
- [WAHA Integration](./WAHA_INTEGRATION.md)

## Support

For issues or questions:
1. Check the logs: `tail -f server/logs/app.log`
2. Test endpoints: `curl http://localhost:5000/health`
3. Review documentation
