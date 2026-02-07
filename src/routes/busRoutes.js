const express = require('express');
const router = express.Router();
const { BusController } = require('../controllers');
const { authMiddleware, optionalAuth } = require('../middlewares');

/**
 * Bus Routes
 */

// Public routes (with optional auth for logging purposes)
router.get('/', BusController.getAll);
router.get('/stats', BusController.getStats);
router.get('/available', BusController.getAvailable);
router.get('/status/:status', BusController.getByStatus);
router.get('/:id', BusController.getById);
router.get('/:id/history', BusController.getHistory);
router.get('/:id/assignments', BusController.getAssignments);

// Protected routes
router.post('/', authMiddleware, BusController.create);

module.exports = router;
