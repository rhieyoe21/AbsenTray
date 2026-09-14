# AbsenTray V2 Server Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies for better-sqlite3
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite

# Copy package files
COPY server/package*.json ./
RUN npm ci --only=production || npm install --only=production

# Copy server code
COPY server/ .

# Create data and logs directories
RUN mkdir -p /app/data /app/logs /app/backups

# Expose ports
EXPOSE 5000

# Start server
CMD ["node", "server.js"]