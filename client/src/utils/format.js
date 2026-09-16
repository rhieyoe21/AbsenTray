// Utilitas parsing & format tanggal/waktu seragam (Asia/Jakarta / WIB).
// Menjamin semua panel menampilkan jam yang konsisten tanpa peduli apakah
// nilai berasal dari kolom DB (string lokal tanpa offset) atau event ISO UTC.

const WIB_TIMEZONE = 'Asia/Jakarta'
const WIB_OFFSET = '+07:00'

/**
 * Parsing nilai tanggal menjadi objek Date.
 * String naive SQLite 'YYYY-MM-DD HH:mm:ss' dianggap sebagai waktu WIB (+07:00),
 * sedangkan ISO string dengan 'Z' atau offset di-parse apa adanya (UTC instant).
 */
export function parseDateWIB(value) {
  if (!value) return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value

  const s = String(value).trim()

  // Format SQLite: 'YYYY-MM-DD HH:mm:ss' atau 'YYYY-MM-DDTHH:mm:ss' tanpa zona
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    const iso = s.replace(' ', 'T')
    const d = new Date(`${iso}${WIB_OFFSET}`)
    return isNaN(d.getTime()) ? null : d
  }

  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Format tanggal & waktu ke bahasa Indonesia dengan zona waktu Asia/Jakarta.
 */
export function formatDateTime(value, options = {}) {
  const d = parseDateWIB(value)
  if (!d) return '—'

  const defaultOpts = {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: WIB_TIMEZONE
  }

  try {
    return d.toLocaleString('id-ID', { ...defaultOpts, ...options })
  } catch {
    return '—'
  }
}

/**
 * Format jam saja (HH:mm:ss) zona Asia/Jakarta.
 */
export function formatTimeOnly(value, options = {}) {
  const d = parseDateWIB(value)
  if (!d) return '—'

  const defaultOpts = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: WIB_TIMEZONE
  }

  try {
    return d.toLocaleTimeString('id-ID', { ...defaultOpts, ...options })
  } catch {
    return '—'
  }
}
