import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

// Create axios instance with base URL
const api = axios.create({
  baseURL: API_BASE_URL
});

// Request interceptor — set Content-Type JSON hanya utk body non-FormData
// (FormData butuh header auto browser agar boundary multipart benar).
api.interceptors.request.use(
  (config) => {
    if (config.data && config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else {
      config.headers['Content-Type'] = 'application/json';
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const errorMessage = error.response?.data?.error?.message || error.message;
    
    // Show toast notification for errors
    if (typeof window !== 'undefined' && window.toast) {
      window.toast.error(errorMessage || 'An error occurred');
    }
    
    return Promise.reject(error);
  }
);

// API endpoints
export const attendanceAPI = {
  getAll: (params) => api.get('/attendance', { params }),
  getStats: (date) => api.get('/attendance/stats/today', { params: { date } }),
  getById: (id) => api.get(`/attendance/${id}`),
  getByDate: (date) => api.get(`/attendance/date/${date}`),
  createManual: (data) => api.post('/attendance/manual', data),
  resend: (id) => api.post(`/attendance/${id}/resend`)
};

export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (uid) => api.get(`/users/${uid}`),
  create: (data) => api.post('/users', data),
  update: (uid, data) => api.put(`/users/${uid}`, data),
  delete: (uid) => api.delete(`/users/${uid}`),
  import: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/users/import', fd);
  },
  export: () => api.get('/users/export')
};

export const templatesAPI = {
  getAll: () => api.get('/templates'),
  getById: (id) => api.get(`/templates/${id}`),
  getByName: (name) => api.get(`/templates/name/${name}`),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`),
  preview: (data) => api.post('/templates/preview', data)
};

export const dashboardAPI = {
  getStats: (date) => api.get('/dashboard/stats', { params: { date } }),
  getRecent: (limit) => api.get('/dashboard/recent', { params: { limit } }),
  getCharts: (date) => api.get('/dashboard/charts', { params: { date } }),
  getDeviceStatus: () => api.get('/dashboard/device-status'),
  getRetryQueue: () => api.get('/dashboard/retry-queue')
};

export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  setPolling: (enabled) => api.post('/settings/polling', { enabled }),
  setScheduleMode: (enabled) => api.post('/settings/schedule-mode', { enabled }),
  setAdminAlerts: (enabled) => api.post('/settings/admin-alerts', { enabled }),
  pingWaha: (number) => api.post('/settings/ping-waha', { number }),
  reconnect: () => api.post('/settings/reconnect'),
  disconnectFingerprint: () => api.post('/settings/disconnect-fingerprint'),
  schedules: {
    list: () => api.get('/settings/schedules'),
    create: (data) => api.post('/settings/schedules', data),
    update: (id, data) => api.put(`/settings/schedules/${id}`, data),
    remove: (id) => api.delete(`/settings/schedules/${id}`)
  },
  testWaha: () => api.post('/settings/test-waha'),
  testFingerprint: () => api.post('/settings/test-fingerprint'),
  testSend: (data) => api.post('/settings/test-send', data)
};

export default api;
