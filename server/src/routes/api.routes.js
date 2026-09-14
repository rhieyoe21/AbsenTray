const express = require('express');
const router = express.Router();
const multer = require('multer');
const { apiLimiter } = require('../middleware/rateLimit');

// Multer in-memory utk upload file (CSV user) — maks 10MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Controllers
const attendanceController = require('../controllers/attendance.controller');
const usersController = require('../controllers/users.controller');
const templatesController = require('../controllers/templates.controller');
const dashboardController = require('../controllers/dashboard.controller');
const settingsController = require('../controllers/settings.controller');

// Apply rate limiting to all API routes
router.use(apiLimiter);

// Attendance routes
router.get('/attendance', attendanceController.getAttendance);
router.get('/attendance/stats/today', attendanceController.getAttendanceStats);
router.get('/attendance/:id', attendanceController.getAttendanceById);
router.post('/attendance/:id/resend', attendanceController.resendAttendance);
router.get('/attendance/date/:date', attendanceController.getAttendanceByDate);
router.post('/attendance/manual', attendanceController.createManualAttendance);

// Users routes
router.get('/users', usersController.getUsers);
router.post('/users/import', upload.single('file'), usersController.importUsers);
router.get('/users/export', usersController.exportUsers);
router.get('/users/:uid', usersController.getUser);
router.post('/users', usersController.createUser);
router.put('/users/:uid', usersController.updateUser);
router.delete('/users/:uid', usersController.deleteUser);

// Templates routes
router.get('/templates', templatesController.getTemplates);
router.get('/templates/:id', templatesController.getTemplate);
router.get('/templates/name/:name', templatesController.getTemplateByName);
router.post('/templates', templatesController.createTemplate);
router.put('/templates/:id', templatesController.updateTemplate);
router.delete('/templates/:id', templatesController.deleteTemplate);
router.post('/templates/preview', templatesController.previewTemplate);

// Dashboard routes
router.get('/dashboard/stats', dashboardController.getStats);
router.get('/dashboard/recent', dashboardController.getRecentActivities);
router.get('/dashboard/charts', dashboardController.getChartData);
router.get('/dashboard/device-status', dashboardController.getDeviceStatus);
router.get('/dashboard/retry-queue', dashboardController.getRetryQueueStatus);

// Settings routes
router.get('/settings', settingsController.getSettings);
router.put('/settings', settingsController.updateSettings);
router.post('/settings/polling', settingsController.setPollingEnabled);
router.post('/settings/schedule-mode', settingsController.setScheduleMode);
router.post('/settings/admin-alerts', settingsController.setAdminAlerts);
router.post('/settings/ping-waha', settingsController.pingWaha);
router.post('/settings/reconnect', settingsController.reconnect);
router.post('/settings/disconnect-fingerprint', settingsController.disconnectFingerprint);
router.get('/settings/schedules', settingsController.getSchedules);
router.post('/settings/schedules', settingsController.createSchedule);
router.put('/settings/schedules/:id', settingsController.updateSchedule);
router.delete('/settings/schedules/:id', settingsController.deleteSchedule);
router.post('/settings/test-waha', settingsController.testWahaConnection);
router.post('/settings/test-fingerprint', settingsController.testFingerprintConnection);
router.post('/settings/test-send', settingsController.sendTestMessage);

module.exports = router;
