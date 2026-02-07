const { Route } = require('../models');
const { RouteService } = require('../services');
const { asyncHandler, successResponse } = require('../utils/helpers');

/**
 * Route Controller - Route-related API endpoints
 */
class RouteController {
    /**
     * Get all routes
     * GET /api/routes
     */
    static getAll = asyncHandler(async (req, res) => {
        const routes = await Route.findAll();
        res.json(successResponse(routes));
    });

    /**
     * Get route by ID
     * GET /api/routes/:id
     */
    static getById = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const route = await RouteService.getWithDetails(id);

        if (!route) {
            return res.status(404).json({
                success: false,
                message: 'Route not found',
            });
        }

        res.json(successResponse(route));
    });

    /**
     * Get routes by status
     * GET /api/routes/status/:status
     */
    static getByStatus = asyncHandler(async (req, res) => {
        const { status } = req.params;
        const validStatuses = ['ACTIVE', 'COMPLETED'];

        if (!validStatuses.includes(status.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Valid values: ${validStatuses.join(', ')}`,
            });
        }

        const routes = await Route.findByStatus(status.toUpperCase());
        res.json(successResponse(routes));
    });

    /**
     * Get active routes with assignments
     * GET /api/routes/active
     */
    static getActive = asyncHandler(async (req, res) => {
        const routes = await RouteService.getActiveWithAssignments();
        res.json(successResponse(routes));
    });

    /**
     * Create a new route
     * POST /api/routes
     */
    static create = asyncHandler(async (req, res) => {
        const { name, startPoint, endPoint, durationMinutes, status } = req.body;

        if (!name || !durationMinutes) {
            return res.status(400).json({
                success: false,
                message: 'Name and duration are required',
            });
        }

        const route = await RouteService.create({
            name,
            startPoint,
            endPoint,
            durationMinutes,
            status
        });
        res.status(201).json(successResponse(route, 'Route created successfully'));
    });

    /**
     * Update route
     * PUT /api/routes/:id
     */
    static update = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { name, startPoint, endPoint, durationMinutes } = req.body;

        const route = await RouteService.update(id, { name, startPoint, endPoint, durationMinutes });

        if (!route) {
            return res.status(404).json({
                success: false,
                message: 'Route not found',
            });
        }

        res.json(successResponse(route, 'Route updated successfully'));
    });

    /**
     * Complete a route
     * POST /api/routes/:id/complete
     */
    static complete = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const adminId = req.admin?.id || null;
        const result = await RouteService.complete(id, adminId);
        res.json(successResponse(result));
    });

    /**
     * Reactivate a route
     * POST /api/routes/:id/reactivate
     */
    static reactivate = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const result = await RouteService.reactivate(id, req.admin.id);
        res.json(successResponse(result));
    });

    /**
     * Delete a route
     * DELETE /api/routes/:id
     */
    static delete = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const result = await RouteService.delete(id, req.admin.id);
        res.json(successResponse(result));
    });

    /**
     * Get route statistics
     * GET /api/routes/stats
     */
    static getStats = asyncHandler(async (req, res) => {
        const stats = await RouteService.getStats();
        res.json(successResponse(stats));
    });

    /**
     * Get route activity history
     * GET /api/routes/:id/history
     */
    static getHistory = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const limit = parseInt(req.query.limit, 10) || 100;

        const route = await Route.findById(id);
        if (!route) {
            return res.status(404).json({
                success: false,
                message: 'Route not found',
            });
        }

        const history = await RouteService.getActivityHistory(id, limit);
        res.json(successResponse({
            route,
            history,
        }));
    });

    /**
     * Get route assignment history
     * GET /api/routes/:id/assignments
     */
    static getAssignments = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const limit = parseInt(req.query.limit, 10) || 50;

        const route = await Route.findById(id);
        if (!route) {
            return res.status(404).json({
                success: false,
                message: 'Route not found',
            });
        }

        const assignments = await RouteService.getAssignmentHistory(id, limit);
        res.json(successResponse({
            route,
            assignments,
        }));
    });
}

module.exports = RouteController;
