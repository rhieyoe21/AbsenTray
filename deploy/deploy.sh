#!/usr/bin/env bash
#
# deploy.sh — satu-perintah instalasi & update AbsenTray V2 di Ubuntu.
# Idempotent: aman dijalankan ulang kapan saja.
#
# Penggunaan:
#   ./deploy.sh            # install/update penuh (deps, build, db, pm2)
#   ./deploy.sh --setup    # hanya bootstrap: node + pm2
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_MAJOR=20

log()  { echo -e "\033[1;32m[deploy]\033[0m $*"; }
warn() { echo -e "\033[1;33m[deploy!]\033[0m $*"; }
die()  { echo -e "\033[1;31m[deploy ERROR]\033[0m $*" >&2; exit 1; }

cd "$APP_DIR"

# 1) Prasyarat sistem
if [ ! -f /etc/os-release ] || ! grep -qi ubuntu /etc/os-release; then
  warn "Tidak terdeteksi sebagai Ubuntu — lanjut dengan hati-hati."
fi

# 2) Node.js LTS (bila kosong)
if [ "${1:-}" == "--setup" ] || ! command -v node >/dev/null 2>&1; then
  log "Memastikan Node.js $NODE_MAJOR terpasang..."
  if ! command -v node >/dev/null 2>&1 || \
     ! node -e "process.exit(parseInt(process.versions.node.split('.')[0]) >= $NODE_MAJOR ? 0 : 1)" 2>/dev/null; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y nodejs build-essential
  fi
fi

# 3) PM2
if ! command -v pm2 >/dev/null 2>&1; then
  log "Memasang PM2..."
  npm install -g pm2
fi

# 4) Dependensi + build
log "Menginstall dependensi server..."
(cd "$APP_DIR/server" && npm ci --omit=dev || npm install --omit=dev)
log "Menginstall dependensi client + build produksi..."
(cd "$APP_DIR/client" && npm ci || npm install)
(cd "$APP_DIR/client" && npm run build)

# 5) Lingkungan (dibuat hanya bila belum ada)
if [ ! -f "$APP_DIR/server/.env" ]; then
  cp "$APP_DIR/server/.env.example" "$APP_DIR/server/.env"
  log "server/.env dibuat dari template — EDIT terlebih dahulu:"
  warn "  nano $APP_DIR/server/.env   (IP device, WAHA URL/key, ADMIN_WHATSAPP)"
fi

# 6) Folder data & log
mkdir -p "$APP_DIR/server/data" "$APP_DIR/server/logs" "$APP_DIR/server/backups"

# 7) Database + data awal
log "Membuat skema database..."
(cd "$APP_DIR/server" && node scripts/init-db.js)

if [ -f "$APP_DIR/server/map_user.csv" ]; then
  log "Import karyawan dari map_user.csv..."
  (cd "$APP_DIR/server" && node scripts/import-users.js)
else
  warn "map_user.csv belum ada — impor karyawan dilewati."
fi

if [ -f "$APP_DIR/server/sent_log.txt" ]; then
  log "Migrasi sent log..."
  (cd "$APP_DIR/server" && node scripts/migrate-sent-logs.js)
fi

# 8) Mulai via PM2
log "Menjalankan layanan via PM2..."
pm2 start "$APP_DIR/ecosystem.config.js" || pm2 restart "$APP_DIR/ecosystem.config.js"
pm2 save

log "Selesai."
echo
echo "  Frontend : http://<server-ip>:3000"
echo "  API      : http://<server-ip>:5000/api"
echo "  Health   : curl http://<server-ip>:5000/health"
echo
pm2 status