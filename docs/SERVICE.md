# AbsenTray V2 - Systemd Service

## Unit File

Create `/etc/systemd/system/absentray.service`:

```ini
[Unit]
Description=AbsenTray V2 Attendance Monitoring
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/AbsenTrayV2/server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=5000

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/AbsenTrayV2/server/data /opt/AbsenTrayV2/server/logs

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=absentray

[Install]
WantedBy=multi-user.target
```

## Install & Enable

```bash
# Copy unit file
sudo cp absentray.service /etc/systemd/system/

# Reload daemon
sudo systemctl daemon-reload

# Enable at boot
sudo systemctl enable absentray

# Start service
sudo systemctl start absentray

# Check status
sudo systemctl status absentray
```

## Common Commands

```bash
# Start
sudo systemctl start absentray

# Stop
sudo systemctl stop absentray

# Restart
sudo systemctl restart absentray

# View logs
journalctl -u absentray -f

# View errors
journalctl -u absentray -p err -n 50
```