const { ActivityService } = require('../services');
const { asyncHandler, successResponse } = require('../utils/helpers');

/**
 * Activity Controller - Activity log endpoints
 */
class ActivityController {
    /**
     * Get all recent activities (combined timeline)
     * GET /api/activities
     */
    static getAll = asyncHandler(async (req, res) => {
        const limit = parseInt(req.query.limit, 10) || 100;
        const activities = await ActivityService.getCombinedTimeline(limit);
        res.json(successResponse(activities));
    });

    /**
     * Get activities by type
     * GET /api/activities/type/:type
     */
    static getByType = asyncHandler(async (req, res) => {
        const { type } = req.params;
        const limit = parseInt(req.query.limit, 10) || 100;

        const validTypes = ['bus', 'driver', 'route'];
        if (!validTypes.includes(type.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: `Invalid type. Valid values: ${validTypes.join(', ')}`,
            });
        }

        const allActivities = await ActivityService.getAllRecent(limit);
        res.json(successResponse(allActivities[type.toLowerCase()]));
    });

    /**
     * Get bus activity history
     * GET /api/history/bus/:id
     */
    static getBusHistory = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const limit = parseInt(req.query.limit, 10) || 100;
        const history = await ActivityService.getBusHistory(id, limit);
        res.json(successResponse(history));
    });

    /**
     * Get driver activity history
     * GET /api/history/driver/:id
     */
    static getDriverHistory = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const limit = parseInt(req.query.limit, 10) || 100;
        const history = await ActivityService.getDriverHistory(id, limit);
        res.json(successResponse(history));
    });

    /**
     * Get route activity history
     * GET /api/history/route/:id
     */
    static getRouteHistory = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const limit = parseInt(req.query.limit, 10) || 100;
        const history = await ActivityService.getRouteHistory(id, limit);
        res.json(successResponse(history));
    });

    /**
     * Get admin-forced activities
     * GET /api/activities/admin-forced
     */
    static getAdminForced = asyncHandler(async (req, res) => {
        const limit = parseInt(req.query.limit, 10) || 100;
        const activities = await ActivityService.getAdminForcedActivities(limit);
        res.json(successResponse(activities));
    });
}

module.exports = ActivityController;
