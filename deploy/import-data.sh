#!/usr/bin/env bash
#
# import-data.sh — impor data produksi (karyawan & sent log) ke server.
# Jalankan SETELAH file di-scp ke server (lihat sync-data.ps1 sisi Windows).
#
# Penggunaan:
#   ./import-data.sh                    # pakai map_user.csv & sent_log.txt di deploy/
#   ./import-data.sh /path/map_user.csv [/path/sent_log.txt]
#
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$DIR")"

MAP="${1:-$DIR/map_user.csv}"
SENT="${2:-$DIR/sent_log.txt}"

log() { echo -e "\033[1;32m[import]\033[0m $*"; }
warn() { echo -e "\033[1;33m[import!]\033[0m $*"; }

if [ -f "$MAP" ]; then
  cp "$MAP" "$APP_DIR/server/map_user.csv"
  log "Impor karyawan dari $MAP..."
  (cd "$APP_DIR/server" && node scripts/import-users.js)
else
  warn "map_user.csv tidak ditemukan: $MAP"
fi

if [ -f "$SENT" ]; then
  cp "$SENT" "$APP_DIR/server/sent_log.txt"
  log "Migrasi sent log dari $SENT..."
  (cd "$APP_DIR/server" && node scripts/migrate-sent-logs.js)
else
  warn "sent_log.txt tidak ditemukan: $SENT"
fi

log "Selesai. Verifikasi via http://<server-ip>:5000/api/users"