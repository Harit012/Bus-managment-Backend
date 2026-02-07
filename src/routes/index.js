const express = require('express');
const router = express.Router();

// Import route modules
const adminRoutes = require('./adminRoutes');
const busRoutes = require('./busRoutes');
const driverRoutes = require('./driverRoutes');
const routeRoutes = require('./routeRoutes');
const { ActivityController } = require('../controllers');

/**
 * Main Router - Aggregates all routes
 */

// Mount routes
router.use('/admin', adminRoutes);
router.use('/buses', busRoutes);
router.use('/drivers', driverRoutes);
router.use('/routes', routeRoutes);

// Activity/History routes
router.get('/activities', ActivityController.getAll);
router.get('/activities/type/:type', ActivityController.getByType);
router.get('/activities/admin-forced', ActivityController.getAdminForced);
router.get('/history/bus/:id', ActivityController.getBusHistory);
router.get('/history/driver/:id', ActivityController.getDriverHistory);
router.get('/history/route/:id', ActivityController.getRouteHistory);

// Health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Bus Management System API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});

module.exports = router;
