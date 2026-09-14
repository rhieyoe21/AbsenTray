# syntax=docker/dockerfile:1

# ---------- Stage 1: build frontend ----------
FROM node:20-slim AS client-build
WORKDIR /build
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---------- Stage 2: install API dependencies ----------
FROM node:20-slim AS server-deps
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev

# ---------- Stage 3: runtime ----------
FROM node:20-slim
ENV NODE_ENV=production \
    PORT=5000 \
    SERVE_CLIENT=1 \
    DB_PATH=./data/attendance.db \
    LOG_FILE=./logs/app.log

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Deps (dari stage 2), lalu source API (tanpa menimpa node_modules)
COPY --from=server-deps /app/node_modules /app/server/node_modules
COPY server/ /app/server/
COPY --from=client-build /build/dist /app/client/dist

# Entrypoint: init skema, impor data bila tersedia, lalu jalankan API.
COPY docker/docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Volume untuk data persisten
VOLUME ["/app/server/data", "/app/server/logs", "/app/server/backups"]

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/health || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]