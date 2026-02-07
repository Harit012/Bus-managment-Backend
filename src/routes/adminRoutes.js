const express = require('express');
const router = express.Router();
const { AdminController } = require('../controllers');
const { authMiddleware } = require('../middlewares');

/**
 * Admin Routes
 * All routes require authentication except login
 */

// Public route - Login
router.post('/login', AdminController.login);

// Protected routes - require authentication
router.use(authMiddleware);

// Dashboard
router.get('/dashboard', AdminController.getDashboard);

// Buses
router.get('/buses', AdminController.getAllBuses);
router.post('/buses/:id/maintenance', AdminController.sendBusToMaintenance);
router.post('/buses/:id/available-from-maintenance', AdminController.setBusAvailableFromMaintenance);
router.post('/buses/:id/available-from-rest', AdminController.setBusAvailableFromRest);

// Drivers
router.get('/drivers', AdminController.getAllDrivers);

// Routes
router.get('/routes/active', AdminController.getActiveRoutes);

// Force assignments
router.post('/force-assign/bus', AdminController.forceAssignBus);
router.post('/force-assign/driver', AdminController.forceAssignDriver);

// Auto-assign
router.post('/auto-assign/:routeId', AdminController.autoAssign);

// Activities
router.get('/activities', AdminController.getActivities);
router.get('/activities/forced', AdminController.getForcedActivities);

module.exports = router;
