const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { AdminUser } = require('../models');
const { BusService, DriverService, RouteService, ActivityService } = require('../services');
const { AssignmentService } = require('../services');
const { asyncHandler, successResponse } = require('../utils/helpers');

/**
 * Admin Controller - Dashboard and admin operations
 */
class AdminController {
    /**
     * Admin login
     * POST /api/admin/login
     */
    static login = asyncHandler(async (req, res) => {
        const { username, password } = req.body;
        // console.log("{ username, password }", { username, password })
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required',
            });
        }

        // Find admin
        const admin = await AdminUser.findByUsername(username);
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        // Verify password
        const isValidPassword = await AdminUser.verifyPassword(password, admin.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        // Generate token
        const token = jwt.sign(
            { id: admin.id, username: admin.username },
            config.JWT.SECRET,
            { expiresIn: config.JWT.EXPIRES_IN }
        );

        res.json(successResponse({
            token,
            admin: {
                id: admin.id,
                username: admin.username,
                email: admin.email,
            },
        }, 'Login successful'));
    });

    /**
     * Get dashboard data
     * GET /api/admin/dashboard
     */
    static getDashboard = asyncHandler(async (req, res) => {
        const [busStats, driverStats, routeStats, activeRoutes] = await Promise.all([
            BusService.getStats(),
            DriverService.getStats(),
            RouteService.getStats(),
            RouteService.getActiveWithAssignments(),
        ]);

        res.json(successResponse({
            buses: {
                available: parseInt(busStats.available, 10),
                running: parseInt(busStats.running, 10),
                rest: parseInt(busStats.rest, 10),
                maintenance: parseInt(busStats.maintenance, 10),
                total: parseInt(busStats.total, 10),
            },
            drivers: {
                available: parseInt(driverStats.available, 10),
                running: parseInt(driverStats.running, 10),
                offDuty: parseInt(driverStats.off_duty, 10),
                total: parseInt(driverStats.total, 10),
            },
            routes: {
                active: parseInt(routeStats.active, 10),
                completed: parseInt(routeStats.completed, 10),
                total: parseInt(routeStats.total, 10),
            },
            activeRoutes,
        }));
    });

    /**
     * Get all buses
     * GET /api/admin/buses
     */
    static getAllBuses = asyncHandler(async (req, res) => {
        const buses = await BusService.getAllWithAssignments();
        res.json(successResponse(buses));
    });

    /**
     * Get all drivers
     * GET /api/admin/drivers
     */
    static getAllDrivers = asyncHandler(async (req, res) => {
        const drivers = await DriverService.getAllWithAssignments();
        res.json(successResponse(drivers));
    });

    /**
     * Get all active routes with assignments
     * GET /api/admin/routes/active
     */
    static getActiveRoutes = asyncHandler(async (req, res) => {
        const routes = await RouteService.getActiveWithAssignments();
        res.json(successResponse(routes));
    });

    /**
     * Send bus to maintenance
     * POST /api/admin/buses/:id/maintenance
     */
    static sendBusToMaintenance = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const result = await BusService.sendToMaintenance(id, req.admin.id);
        res.json(successResponse(result));
    });

    /**
     * Set bus available from maintenance
     * POST /api/admin/buses/:id/available-from-maintenance
     */
    static setBusAvailableFromMaintenance = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const result = await BusService.setAvailableFromMaintenance(id, req.admin.id);
        res.json(successResponse(result));
    });

    /**
     * Set bus available from rest
     * POST /api/admin/buses/:id/available-from-rest
     */
    static setBusAvailableFromRest = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const result = await BusService.setAvailableFromRest(id, req.admin.id);
        res.json(successResponse(result));
    });

    /**
     * Force assign bus to route
     * POST /api/admin/force-assign/bus
     */
    static forceAssignBus = asyncHandler(async (req, res) => {
        const { routeId, busId } = req.body;

        if (!routeId || !busId) {
            return res.status(400).json({
                success: false,
                message: 'routeId and busId are required',
            });
        }

        const result = await AssignmentService.forceAssignBusToRoute(routeId, busId, req.admin.id);
        res.json(successResponse(result));
    });

    /**
     * Force assign driver to route
     * POST /api/admin/force-assign/driver
     */
    static forceAssignDriver = asyncHandler(async (req, res) => {
        const { routeId, driverId } = req.body;

        if (!routeId || !driverId) {
            return res.status(400).json({
                success: false,
                message: 'routeId and driverId are required',
            });
        }

        const result = await AssignmentService.forceAssignDriverToRoute(routeId, driverId, req.admin.id);
        res.json(successResponse(result));
    });

    /**
     * Auto-assign bus and driver to route
     * POST /api/admin/auto-assign/:routeId
     */
    static autoAssign = asyncHandler(async (req, res) => {
        const { routeId } = req.params;
        const result = await AssignmentService.assignDriverAndBusToRoute(routeId);
        res.json(successResponse(result));
    });

    /**
     * Get all activity logs
     * GET /api/admin/activities
     */
    static getActivities = asyncHandler(async (req, res) => {
        const limit = parseInt(req.query.limit, 10) || 100;
        const activities = await ActivityService.getCombinedTimeline(limit);
        res.json(successResponse(activities));
    });

    /**
     * Get admin-forced activities
     * GET /api/admin/activities/forced
     */
    static getForcedActivities = asyncHandler(async (req, res) => {
        const limit = parseInt(req.query.limit, 10) || 100;
        const activities = await ActivityService.getAdminForcedActivities(limit);
        res.json(successResponse(activities));
    });
}

module.exports = AdminController;
