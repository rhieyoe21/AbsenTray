const rateLimit = require('express-rate-limit');

// Nomor IP yang dibebaskan dari pembatasan (whitelist).
// Format: daftar dipisah koma; mendukung wildcard di akhir dengan `*`,
// mis. "127.0.0.1,192.168.1.*,10.0.0.25". Loopback selalu dilewati otomatis.
const WHITELIST = (process.env.RATE_LIMIT_WHITELIST || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Normalisasi IPv4-mapped (::ffff:a.b.c.d -> a.b.c.d) agar mudah dibanding.
function normalizeIp(ip) {
  if (!ip) return '';
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function isWhitelisted(req) {
  const ip = normalizeIp(req.ip);
  if (!ip) return false;
  if (ip === '127.0.0.1' || ip === '::1') return true;

  return WHITELIST.some((raw) => {
    const pattern = normalizeIp(raw);
    if (!pattern) return false;
    // '192.168.1.*'  →  cocok dengan awal '192.168.1.'
    // '10.0.*'       →  cocok dengan awal '10.0.'
    if (pattern.endsWith('*')) {
      return ip.startsWith(pattern.slice(0, -1));
    }
    return ip === pattern;
  });
}

// Rate limiter untuk API umum — konfigurabel via env:
//   RATE_LIMIT_WINDOW_MS  (default 15 menit = 900000)
//   RATE_LIMIT_MAX        (default 1000 per window — dashboard mem-ping
//                           beberapa endpoint tiap 30 detik)
// Akses dari proxy/whitelist tidak dihitung.
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 1000,
  message: { success: false, error: 'Terlalu banyak permintaan, coba lagi beberapa saat.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isWhitelisted(req)
});

// Rate limiter ketat untuk endpoint yang sensitif (login/token).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Terlalu banyak percobaan, coba lagi nanti.' },
  skipSuccessfulRequests: true,
  skip: (req) => isWhitelisted(req)
});

module.exports = {
  apiLimiter,
  authLimiter,
  isWhitelisted
};