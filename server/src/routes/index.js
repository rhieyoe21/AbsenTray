const express = require('express');
const router = express.Router();
const apiRoutes = require('./api.routes');

// Mount API routes
router.use('/', apiRoutes);

module.exports = router;
