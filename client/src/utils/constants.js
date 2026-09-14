// API URL configuration.
// Default: relative path — mengikuti host/port yang dipakai membuka dashboard
// (single-container: API & frontend berada di origin yang sama).
// Override only via VITE_API_URL saat build utk origin terpisah.
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || '';

// App constants
export const APP_NAME = 'AbsenTray V2';
export const VERSION = '1.0.0';

// Attendance modes
export const ATTENDANCE_MODES = {
  MASUK: 'Masuk',
  PULANG: 'Pulang'
};

// Status colors
export const STATUS_COLORS = {
  pending: 'warning',
  sent: 'success',
  failed: 'error',
  retrying: 'info'
};

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// Chart colors (for light/dark mode)
export const CHART_COLORS = {
  light: {
    primary: '#3B82F6',
    secondary: '#10B981',
    accent: '#F59E0B',
    background: '#F9FAFB'
  },
  dark: {
    primary: '#60A5FA',
    secondary: '#34D399',
    accent: '#FCD34D',
    background: '#111827'
  }
};

// Date/time formats
export const DATE_FORMATS = {
  long: 'dddd, DD MMMM YYYY',
  short: 'DD/MM/YYYY',
  time: 'HH:mm:ss'
};

// WhatsApp message templates
export const DEFAULT_TEMPLATES = {
  attendance_notification: {
    name: 'Attendance Notification',
    content: '✅ *Presensi {mode}*\nNama: {name}\nUID: {uid}\nHari: {date}\nJam: {time}',
    variables: ['name', 'uid', 'date', 'time', 'mode']
  }
};
