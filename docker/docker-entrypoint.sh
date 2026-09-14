#!/bin/sh
set -e

echo "[entrypoint] AbsenTray init..."
cd /app/server

node scripts/init-db.js

if [ -f /app/server/map_user.csv ]; then
  echo "[entrypoint] impor karyawan → map_user.csv"
  node scripts/import-users.js || echo "[entrypoint] impor karyawan gagal/lewati"
fi

if [ -f /app/server/sent_log.txt ]; then
  echo "[entrypoint] migrasi sent log → sent_log.txt"
  node scripts/migrate-sent-logs.js || echo "[entrypoint] migrasi sent log gagal/lewati"
fi

echo "[entrypoint] menjalankan server..."
exec node server.js