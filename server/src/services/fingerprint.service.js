const ZKLib = require('node-zklib');
const moment = require('moment-timezone');
const config = require('../config');
const logger = require('../utils/logger');
const database = require('./database.service');
const { EventEmitter } = require('events');

// Normalize an unknown error into a printable string (some ZK errors have
// no `.message` — e.g. ZKError wrapping a bare code).
function errMsg(error) {
  if (typeof error === 'string') return error;
  if (!error) return 'unknown error';
  if (error.message) return typeof error.message === 'string' ? error.message : JSON.stringify(error.message);
  if (error.code) return String(error.code);
  try { return JSON.stringify(error); } catch (e) { return 'unknown error'; }
}

// node-zklib occasionally leaves the underlying socket half-alive after
// disconnect(). Destroy every reachable socket handle so one device never ends
// up with multiple lingering sessions.
function forceDestroySocket(conn) {
  if (!conn) return;
  const candidates = [
    conn.socket,
    conn._socket,
    conn.udpSocket,
    conn.udp_socket,
    conn.client,
    conn._this && conn._this.socket,
    conn.zklibTcp && conn.zklibTcp.socket,
    conn.zklibUdp && conn.zklibUdp.socket
  ];
  for (const s of candidates) {
    if (!s) continue;
    try { if (typeof s.destroy === 'function') s.destroy(); } catch (e) { /* ignore */ }
    try { if (typeof s.close === 'function') s.close(); } catch (e) { /* ignore */ }
  }
}

// node-zklib (utils.parseTimeToDate) membangun Date dari FIELD jam device
// menggunakan konstruktor lokal server: `new Date(y, m, d, hh, mm, ss)`.
// Akibatnya recordTime BUKAN instant mutlak — nilainya bergeser tergantung
// TZ server (container UTC vs mesin dev WIB). Perbaikan transformLog
// menginterpretasikan jam dinding device sebagai Asia/Jakarta secara
// eksplisit, sehingga hasilnya benar di TZ server mana pun.

class FingerprintService extends EventEmitter {
  constructor() {
    super();
    
    this.devices = [{
      ip: config.fingerprint.ip,
      port: config.fingerprint.port,
      timeout: config.fingerprint.timeout,
      protocol: 'tcp'
    }];
    
    this.connections = new Map(); // device_ip -> connection
    this.pollingInterval = null;
    this.pollingEnabled = false;
    this.lastPollTime = null;
    this.deviceOnline = false;
    this.lastConnectionState = false; // To track state change for alerts
    this.scheduleEnabled = false; // Only poll within configured schedules
    this.manualDisconnected = false; // Manual disconnect pauses polling until reconnect
    this.transportPref = {}; // device_ip -> 'tcp' | 'udp' (preferred transport)
    this.readFailStreak = {}; // device_ip -> consecutive failed log reads
    this.lastLogCount = {}; // device_ip -> last known device log count
    this.hasSynced = {}; // device_ip -> true after a full successful read
    this.lastFullReadAt = {}; // device_ip -> timestamp of last full read
    this._polling = false; // true while a poll pass is running
    this._deviceLock = Promise.resolve(); // serializes connect/disconnect calls
    
    // Queue pending logs in memory (processed by scheduler)
    this.pendingLogs = [];
    
    logger.info('FingerprintService initialized', {
      device: `${config.fingerprint.ip}:${config.fingerprint.port}`
    });
  }

  async setEnabled(enabled) {
    this.pollingEnabled = !!enabled;
    
    // Turning polling OFF also drops the device connection immediately,
    // so the dashboard shows the device as disconnected right away.
    if (!enabled) {
      this.deviceOnline = false;
      if (this.connections.size > 0) {
        for (const ip of [...this.connections.keys()]) {
          await this.disconnect(ip).catch(() => {});
        }
      }
      logger.info('Fingerprint polling disabled — device connection dropped');
    } else {
      // Re-enabling polling clears any manual pause so the loop reconnects
      // without needing the user to press "Hubungkan" again.
      this.manualDisconnected = false;
      // Kick off an immediate pass instead of waiting for the next interval.
      this.pollDevice(this._callback).catch((e) => logger.error('Initial poll after enable failed', { error: errMsg(e) }));
    }
    
    this.emit('polling:toggled', this.pollingEnabled);
    return this.pollingEnabled;
  }

  // Evaluate whether current time falls inside any active polling schedule.
  // Returns true when schedules table is empty (polling allowed anytime) unless schedule mode forced off.
  // Selalu dievaluasi dalam zona waktu lokal (Asia/Jakarta / config.timezone),
  // bukan timezone server/container yang sering kali UTC+0.
  isInSchedule() {
    try {
      if (!this.scheduleEnabled) return true; // manual toggle takes precedence when off
      const schedules = database.getActivePollingSchedules();
      if (schedules.length === 0) return false; // schedules configured but none active
      
      const tz = config.timezone || 'Asia/Jakarta';
      const now = moment().tz(tz);
      const day = now.day(); // 0=Sunday ... 6=Saturday
      const cur = now.format('HH:mm');
      
      return schedules.some(s => {
        // Multi-day schedules: `days` JSON array, fallback to single day_of_week
        let daysMatches = false;
        if (s.days) {
          try {
            const days = JSON.parse(s.days);
            daysMatches = Array.isArray(days) && days.includes(day);
          } catch (e) {
            daysMatches = false;
          }
        } else {
          daysMatches = s.day_of_week === day;
        }
        
        if (!daysMatches) return false;
        return cur >= s.start_time && cur < s.end_time;
      });
    } catch (error) {
      logger.warn('Failed to evaluate polling schedule', { error: error.message });
      return true; // fail-open: poll on error to avoid missing attendance
    }
  }

  // Serialize connect/disconnect so two callers (polling, health check, manual
  // reconnect) can never open overlapping sessions — the device only accepts ONE.
  _withDeviceLock(task) {
    const run = this._deviceLock.then(task, task);
    this._deviceLock = run.then(() => {}, () => {});
    return run;
  }

  // Wait until any in-flight poll pass finishes. Returns true when idle.
  async _waitForIdle(timeoutMs = 25000) {
    const deadline = Date.now() + timeoutMs;
    while (this._polling && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 250));
    }
    return !this._polling;
  }

  isPolling() {
    return !!this._polling;
  }

  // Force an immediate single polling pass (used by "Refresh Connection" and manual checks).
  async refreshConnection(callback) {
    logger.info('Manual refresh requested');
    
    // A poll pass can take tens of seconds (it paginates every stored record).
    // Waiting for it is far friendlier than refusing the manual reconnect —
    // refusing here was the reason "Perbarui koneksi"/"Hubungkan" felt broken.
    const idle = await this._waitForIdle(25000);
    if (!idle) {
      logger.warn('Manual refresh — previous poll still running, forcing a clean reconnect');
      // Tear the old socket down; the in-flight read will fail fast and the
      // next poll cycle will rebuild the session from scratch.
      for (const ip of [...this.connections.keys()]) {
        await this.disconnect(ip).catch(() => {});
      }
    }
    
    this.lastPollTime = new Date();
    this.manualDisconnected = false;
    
    try {
      // If device IP/port config changed, drop old socket before reconnecting
      const device = { ...this.devices[0], ip: config.fingerprint.ip, port: config.fingerprint.port };
      const existing = this.connections.get(device.ip);
      if (existing && (device.ip !== this.devices[0].ip || device.port !== this.devices[0].port)) {
        await this.disconnect(device.ip).catch(() => {});
      }
      this.devices[0] = device;
      
      const connected = await this.connect(device);
      if (!connected) {
        // connect() already emitted device:offline if the device is truly unreachable.
        return { success: false, error: 'Failed to connect to fingerprint device' };
      }
      
      // Fetch one batch of logs
      const logs = await this.getAttendanceLogs();
      let processed = 0;
      
      for (const log of logs) {
        const record = this.transformLog(log);
        if (record && callback && typeof callback === 'function') {
          callback(record);
          processed++;
        }
      }
      
      // Keep the connection open — closing it after every poll makes the device
      // look permanently offline on the dashboard.
      
      return { success: true, logsFound: logs.length, processed };
    } catch (error) {
      logger.error('Manual refresh failed', { error: errMsg(error) });
      this.emit('device:error', { error: errMsg(error) });
      return { success: false, error: errMsg(error) };
    }
  }

  // Manual disconnect: drops the socket and pauses polling until "Connect".
  async manualDisconnectAll() {
    this.manualDisconnected = true;
    this.deviceOnline = false;
    this.lastConnectionState = false; // so a later connect emits device:recovered
    for (const ip of this.connections.keys()) {
      await this.disconnect(ip).catch(() => {});
    }
    logger.warn('Fingerprint device disconnected manually (polling paused until reconnect)');
    this.emit('device:manual-disconnect', { manualDisconnected: true });
    return true;
  }

  async connect(device = this.devices[0]) {
    return this._withDeviceLock(() => this._connectInternal(device));
  }

  // node-zklib's public createSocket() always starts with TCP and only falls
  // back to UDP for ECONNREFUSED. Use its transport implementations directly
  // so a TCP timeout/reset can still be retried over UDP.
  async _createTransportConnection(device, protocol, timeout) {
    const zk = new ZKLib(device.ip, device.port, timeout, 4000);
    if (protocol === 'udp') {
      await zk.zklibUdp.createSocket();
      await zk.zklibUdp.connect();
    } else {
      await zk.zklibTcp.createSocket();
      await zk.zklibTcp.connect();
    }
    zk.connectionType = protocol;
    return zk;
  }

  async _connectInternal(device = this.devices[0]) {
    const { ip, port, timeout } = device;
    let lastError = null;

    try {
      // Never stack multiple sessions to the same device — tear down any
      // previous connector/handle for this IP first.
      if (this.connections.has(ip)) {
        await this._disconnectInternal(ip).catch(() => {});
      }
      
      logger.info(`Connecting to fingerprint device ${ip}:${port}...`);

      // A reachable IP does not guarantee that the device accepts TCP. Some
      // ZKTeco firmware responds more reliably over UDP, so retry both
      // transports before declaring the device offline.
      const preferred = this.transportPref[ip] || 'tcp';
      const transports = [preferred, preferred === 'tcp' ? 'udp' : 'tcp'];
      const requestTimeout = Math.max(timeout || 10000, 15000);

      for (const protocol of transports) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          let zk = null;
          try {
            zk = await this._createTransportConnection({ ip, port }, protocol, requestTimeout);
            const info = await zk.getInfo();

            // Store only a fully handshaken connection. A socket that was
            // created but failed getInfo() must never be reused by polling.
            this.connections.set(ip, zk);
            this.transportPref[ip] = protocol;
            this.deviceOnline = true;
            this.hasSynced[ip] = false;
            logger.info(`Connection ready ${ip}:${port} (${protocol}, attempt ${attempt})`);
            logger.info(`Connected to device ${ip}`, {
              userCounts: info.userCounts,
              logCounts: info.logCounts,
              logCapacity: info.logCapacity
            });
            this.emit('connection:established', { ip, protocol, ...info });
            database.logDeviceStatus(ip, 'online', `Device connected successfully via ${protocol}`);
            if (!this.lastConnectionState) this.emit('device:recovered', ip);
            this.lastConnectionState = true;
            return { zk, info };
          } catch (error) {
            lastError = error;
            if (zk) {
              try { await zk.disconnect(); } catch (e) { /* best effort */ }
              forceDestroySocket(zk);
            }
            if (attempt < 2) {
              await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
            }
            logger.warn(`Fingerprint ${protocol} connection attempt failed`, {
              ip, attempt, error: errMsg(error)
            });
          }
        }
      }

      throw lastError || new Error('No fingerprint transport succeeded');
    } catch (error) {
      logger.error(`Failed to connect to fingerprint device ${ip}:${port}`, {
        error: errMsg(error),
        code: error.code
      });
      
      this.deviceOnline = false;
      
      database.logDeviceStatus(ip, 'offline', errMsg(error));
      
      // Emit offline alert only if previously online
      if (this.lastConnectionState) {
        this.emit('device:offline', { ip, error: errMsg(error) });
      }
      this.lastConnectionState = false;
      
      return null;
    }
  }

  async disconnect(ip) {
    return this._withDeviceLock(() => this._disconnectInternal(ip));
  }

  async _disconnectInternal(ip) {
    try {
      const conn = this.connections.get(ip);
      if (conn) {
        try {
          await conn.disconnect();
        } catch (e) { /* best effort */ }
        
        // node-zklib does not always destroy the underlying socket — force it so
        // stale connections don't pile up (device only accepts ONE session).
        forceDestroySocket(conn);
        
        this.connections.delete(ip);
        logger.info(`Disconnected from device ${ip}`);
      }
      
      this.deviceOnline = false;
      this.emit('connection:closed', { ip });
      
      return true;
    } catch (error) {
      logger.error(`Failed to disconnect from device ${ip}`, { error: errMsg(error) });
      return false;
    }
  }

  // Read attendance records from an open connection (handle disable/enable).
  async _readWithDisable(conn) {
    // Give the device a moment to settle after the handshake — some X-series
    // firmwares reset the socket if a data command arrives too quickly.
    await new Promise((r) => setTimeout(r, 400));
    
    let disableBeforeRead = true;
    try {
      disableBeforeRead = database.getSetting('fingerprint_disable_before_read') !== '0';
    } catch (e) { /* keep default */ }
    
    if (disableBeforeRead && typeof conn.disableDevice === 'function') {
      try { await conn.disableDevice(); } catch (e) { /* best effort */ }
    }
    
    let logs;
    try {
      logs = await conn.getAttendances();
    } finally {
      if (typeof conn.enableDevice === 'function') {
        try { await conn.enableDevice(); } catch (e) { /* best effort */ }
      }
    }
    
    return logs;
  }

  async getAttendanceLogs() {
    const results = [];
    
    for (const device of this.devices) {
      const { ip } = device;
      let conn = this.connections.get(ip);
      
      // No live connection yet → open one using the preferred transport.
      if (!conn) {
        const pref = this.transportPref[ip] || 'tcp';
        const mode = pref;

        if (mode === 'udp') {
          try {
            const timeout = Math.max(config.fingerprint.timeout || 10000, 30000);
            conn = new ZKLib(config.fingerprint.ip, config.fingerprint.port, timeout, 4000, 0, 'udp');
            await conn.createSocket();
            this.connections.set(ip, conn);
            this.deviceOnline = true;
          } catch (e) {
            logger.warn(`UDP connection failed for ${ip}, falling back to TCP`, { error: errMsg(e) });
            await this.connect(device);
            conn = this.connections.get(ip);
          }
        } else {
          await this.connect(device);
          conn = this.connections.get(ip);
        }
        
        if (!conn) continue;
      }
      
      const isUdp = this.transportPref[ip] === 'udp';
      try {
        // Cheap change detection: getInfo returns the device's stored log count.
        // If it hasn't changed since the last full sync, skip pulling the whole
        // (potentially thousands of) records — repeated heavy reads are a common
        // cause of the device resetting the socket mid-poll.
        let currentCount = null;
        try {
          const info = await conn.getInfo();
          if (info && typeof info.logCounts === 'number') currentCount = info.logCounts;
        } catch (e) {
          currentCount = null; // can't read count → do a normal full read
        }

        const recentlySynced = this.lastFullReadAt[ip] &&
          (Date.now() - this.lastFullReadAt[ip]) < 120000;
        if (currentCount !== null && this.hasSynced[ip] && recentlySynced &&
            this.lastLogCount[ip] === currentCount) {
          this.readFailStreak[ip] = 0;
          logger.debug(`No new logs on ${ip} (count ${currentCount}) — skipping full read`);
          continue;
        }

        logger.info(`Fetching attendance logs from ${ip} (${isUdp ? 'udp' : 'tcp'})...`);
        const logs = await this._readWithDisable(conn);
        
        // read OK → reset fail streak, keep transport preference
        this.readFailStreak[ip] = 0;
        if (currentCount !== null) {
          this.lastLogCount[ip] = currentCount;
          this.hasSynced[ip] = true;
        } else {
          this.hasSynced[ip] = false;
        }
        this.lastFullReadAt[ip] = Date.now();
        
        if (logs && logs.data && logs.data.length > 0) {
          logger.info(`Found ${logs.data.length} attendance logs from ${ip}`);
          logs.data.forEach(log => {
            results.push({
              deviceIp: ip,
              userSn: log.userSn,
              deviceUserId: log.deviceUserId,
              recordTime: log.recordTime,
              ip: log.ip
            });
          });
        } else {
          logger.debug('No new attendance logs');
        }
      } catch (error) {
        // First failure may be a transient/reset right after connect.
        const streak = (this.readFailStreak[ip] || 0) + 1;
        this.readFailStreak[ip] = streak;
        
        // If TCP just failed, try UDP once in the same cycle — X-series
        // firmwares frequently answer better over UDP.
        if (!isUdp) {
          let udpOk = false;
          try {
            logger.warn(`TCP read failed for ${ip}, trying UDP fallback...`, { error: errMsg(error) });
            await this.disconnect(ip).catch(() => {});
            
            const timeout = Math.max(config.fingerprint.timeout || 10000, 30000);
            const udpConn = await this._createTransportConnection({
              ip: config.fingerprint.ip,
              port: config.fingerprint.port
            }, 'udp', timeout);
            
            const udpLogs = await this._readWithDisable(udpConn);
            this.connections.set(ip, udpConn);
            this.deviceOnline = true;
            this.transportPref[ip] = 'udp';
            this.readFailStreak[ip] = 0;
            // New socket → force a full verification read next cycle.
            this.hasSynced[ip] = false;
            udpOk = true;
            
            if (udpLogs && udpLogs.data && udpLogs.data.length > 0) {
              logger.info(`UDP fallback: found ${udpLogs.data.length} attendance logs from ${ip}`);
              udpLogs.data.forEach(log => {
                results.push({
                  deviceIp: ip,
                  userSn: log.userSn,
                  deviceUserId: log.deviceUserId,
                  recordTime: log.recordTime,
                  ip: log.ip
                });
              });
            }
          } catch (udpError) {
            // UDP also failed.
            await this.disconnect(ip).catch(() => {}); // drop the UDP socket we created
            this.emit('device:error', { ip, error: errMsg(udpError) });
          }
          if (udpOk) continue;
        } else {
          logger.warn(`UDP read failed for ${ip}`, { error: errMsg(error), streak });
        }
        
        // NOT disconnecting here: a read failure is not proof the device is
        // offline. The socket stays, and the next poll simply retries. Only a
        // long fail streak forces a clean reconnect (stuck socket recovery).
        if (streak >= 3) {
          logger.warn(`Failed to read logs ${streak}x from ${ip} — resetting connection`, {
            error: errMsg(error)
          });
          await this.disconnect(ip).catch(() => {});
          this.readFailStreak[ip] = 0;
        }
      }
    }
    
    return results;
  }

  async getUsers() {
    const allUsers = [];
    
    for (const device of this.devices) {
      const { ip } = device;
      const conn = this.connections.get(ip);
      
      if (conn) {
        try {
          const users = await conn.getUsers();
          allUsers.push(...users.data);
        } catch (error) {
          logger.error(`Failed to get users from ${ip}`, { error: error.message });
        }
      }
    }
    
    return allUsers;
  }

  async getDeviceInfo(ip) {
    const conn = this.connections.get(ip);
    if (!conn) return null;
    
    try {
      const info = await conn.getInfo();
      return info;
    } catch (error) {
      logger.error(`Failed to get device info from ${ip}`, { error: error.message });
      return null;
    }
  }

  // Health check. NON-DESTRUCTIVE: it must never disconnect the live session
  // that the poller relies on (doing so was making the device appear to drop
  // by itself every health-check interval).
  async checkConnection() {
    const device = this.devices[0];
    const ip = device.ip;

    // Don't interleave with an in-flight poll — report the last known state.
    if (this.isPolling()) {
      return this.deviceOnline;
    }

    const conn = this.connections.get(ip);
    if (conn) {
      // A live session exists → probe it in place and keep it open.
      try {
        await conn.getInfo();
        this.deviceOnline = true;
        this.lastConnectionState = true;
        return true;
      } catch (error) {
        logger.warn(`Health check on live connection failed for ${ip} — reconnecting`, { error: errMsg(error) });
        await this.disconnect(ip).catch(() => {});
      }
    }

    // Polling intentionally paused → do NOT reopen a session on our own.
    if (this.manualDisconnected || !this.pollingEnabled) {
      this.deviceOnline = false;
      return false;
    }

    // No live session → establish one and keep it for the next poll.
    const result = await this.connect(device);
    return !!result;
  }

  async getRealTimeLogs(callback) {
    const device = this.devices[0];
    const conn = this.connections.get(device.ip);
    
    if (conn) {
      conn.getRealTimeLogs((event) => {
        logger.debug('Real-time event', { event });
        
        if (callback && typeof callback === 'function') {
          callback(event);
        }
      });
    }
  }

  startPolling(callback) {
    if (this.pollingEnabled) {
      logger.warn('Polling already started');
      return;
    }
    
    this.pollingEnabled = true;
    this._callback = callback;
    const interval = config.fingerprint.pollingInterval;
    
    logger.info(`Starting fingerprint polling every ${interval}ms`);
    
    // Immediate first poll
    this.pollDevice(callback);
    
    this.pollingInterval = setInterval(() => {
      this.pollDevice(this._callback || callback);
    }, interval);
  }

  async pollDevice(callback) {
    // Never run two polls at once — with a 30s interval and a 30s read timeout
    // they would overlap, opening a second device session and corrupting reads.
    if (this._polling) {
      logger.debug('Poll skipped — previous poll still in progress');
      return;
    }
    
    this.lastPollTime = new Date();
    this._polling = true;
    
    try {
      // Respect manual toggle + polling schedule
      if (!this.pollingEnabled) {
        logger.debug('Polling skipped: manually disabled');
        return;
      }
      if (this.manualDisconnected) {
        logger.debug('Polling skipped: device disconnected manually');
        return;
      }
      if (!this.isInSchedule()) {
        logger.debug('Polling skipped: outside active schedule');
        return;
      }
      
      // Connect if not connected
      if (this.connections.size === 0) {
        const device = this.devices[0];
        await this.connect(device);
      }
      
      if (this.connections.size === 0) {
        // connect failed -> already logged + alerted
        return;
      }
      
      // Get attendance logs
      const logs = await this.getAttendanceLogs();
      
      if (logs.length > 0) {
        logger.info(`Polled ${logs.length} new attendance logs`);
        
        // Process each log
        for (const log of logs) {
          // Transform to canonical format
          const record = this.transformLog(log);
          
          if (record && callback && typeof callback === 'function') {
            callback(record);
          }
        }
      }
      
      // Keep the connection open — closing it after every poll makes the device
      // look permanently offline on the dashboard.
      
    } catch (error) {
      logger.error('Polling error', { error: errMsg(error) });
      
      // getAttendanceLogs handles read failures and resets a stuck socket after
      // several consecutive failures. Do not tear down a healthy session for a
      // single transient error here; doing so caused avoidable disconnects.
      this.emit('device:error', { error: errMsg(error) });
    } finally {
      this._polling = false;
    }
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    this.pollingEnabled = false;
    logger.info('Fingerprint polling stopped');
  }

  // Interpretasikan field jam/menit/detik device sebagai jam dinding Asia/Jakarta
  // secara eksplisit agar bebas dari TZ server tempat Node berjalan.
  transformLog(log) {
    let ts = log.recordTime || Date.now();
    let date = ts instanceof Date ? ts
      : typeof ts === 'number' ? new Date(ts * 1000)
      : new Date(ts);

    let timestamp;
    if (ts instanceof Date) {
      // Ambil jam dinding device (get* membaca angka lokal yang tadi dipasang oleh parseTimeToDate)
      const tz = config.timezone || 'Asia/Jakarta';
      timestamp = moment.tz([
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds()
      ], tz).toDate();
    } else {
      timestamp = date;
    }

    return {
      deviceIp: log.deviceIp || log.ip,
      userId: log.deviceUserId || log.userSn,
      timestamp,
      raw: log
    };
  }

  // Apply runtime configuration changes from Settings page.
  applyFingerprintConfig({ ip, port, timeout, pollingInterval } = {}) {
    if (ip) config.fingerprint.ip = ip;
    if (port) config.fingerprint.port = parseInt(port);
    if (timeout) config.fingerprint.timeout = parseInt(timeout);
    if (pollingInterval) config.fingerprint.pollingInterval = parseInt(pollingInterval);
    
    const oldIp = this.devices[0] && this.devices[0].ip;
    const oldPort = this.devices[0] && this.devices[0].port;
    
    this.devices[0] = {
      ip: config.fingerprint.ip,
      port: config.fingerprint.port,
      timeout: config.fingerprint.timeout,
      protocol: 'tcp'
    };
    
    // Device address changed → drop old socket so reconnection targets the new one.
    if ((oldIp && oldIp !== config.fingerprint.ip) || (oldPort && oldPort !== config.fingerprint.port)) {
      if (this.connections.size > 0) {
        [...this.connections.keys()].forEach(ip => this.disconnect(ip).catch(() => {}));
        logger.warn('Device address changed — dropped existing connection', { from: `${oldIp}:${oldPort}` });
      }
      if (this.manualDisconnected) this.manualDisconnected = false;
    }
    
    // Restart timer with new interval if polling running
    if (this.pollingEnabled && this.pollingInterval) {
      clearInterval(this.pollingInterval);
      const interval = config.fingerprint.pollingInterval;
      this.pollingInterval = setInterval(() => {
        this.pollDevice(this._callback);
      }, interval);
    }
    
    logger.info('Fingerprint configuration applied', {
      ip: config.fingerprint.ip,
      port: config.fingerprint.port,
      interval: config.fingerprint.pollingInterval
    });
  }

  setScheduleEnabled(enabled) {
    this.scheduleEnabled = !!enabled;
    logger.info(`Polling schedule mode ${this.scheduleEnabled ? 'ENABLED' : 'DISABLED'}`);
  }

  getStatus() {
    let activeSchedules = 0;
    try {
      activeSchedules = database.getActivePollingSchedules().length;
    } catch (e) { /* ignore */ }
    
    return {
      deviceOnline: this.deviceOnline,
      connectedDevices: [...this.connections.keys()],
      manualDisconnected: this.manualDisconnected,
      pollingEnabled: this.pollingEnabled,
      pollingInterval: config.fingerprint.pollingInterval,
      lastPollTime: this.lastPollTime,
      scheduleEnabled: this.scheduleEnabled,
      activeSchedules,
      inSchedule: this.pollingEnabled ? this.isInSchedule() : null
    };
  }
}

// Singleton instance
const fingerprintService = new FingerprintService();
module.exports = fingerprintService;
