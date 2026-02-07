const express = require('express');
const router = express.Router();
const { DriverController } = require('../controllers');
const { authMiddleware } = require('../middlewares');

/**
 * Driver Routes
 */

// Public routes
router.get('/', DriverController.getAll);
router.get('/stats', DriverController.getStats);
router.get('/available', DriverController.getAvailable);
router.get('/status/:status', DriverController.getByStatus);
router.get('/:id', DriverController.getById);
router.get('/:id/history', DriverController.getHistory);
router.get('/:id/assignments', DriverController.getAssignments);

// Protected routes
router.post('/', authMiddleware, DriverController.create);

module.exports = router;
