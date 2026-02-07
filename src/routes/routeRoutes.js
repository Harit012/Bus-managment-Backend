const express = require('express');
const router = express.Router();
const { RouteController } = require('../controllers');
const { authMiddleware, optionalAuth } = require('../middlewares');

/**
 * Route Routes (API routes for managing bus routes)
 */

// Public routes
router.get('/', RouteController.getAll);
router.get('/stats', RouteController.getStats);
router.get('/active', RouteController.getActive);
router.get('/status/:status', RouteController.getByStatus);
router.get('/:id', RouteController.getById);
router.get('/:id/history', RouteController.getHistory);
router.get('/:id/assignments', RouteController.getAssignments);

// Protected routes
router.post('/', authMiddleware, RouteController.create);
router.put('/:id', authMiddleware, RouteController.update);
router.delete('/:id', authMiddleware, RouteController.delete);
router.post('/:id/complete', optionalAuth, RouteController.complete);
router.post('/:id/reactivate', authMiddleware, RouteController.reactivate);

module.exports = router;
