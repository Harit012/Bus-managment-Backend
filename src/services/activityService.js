const { BusActivityLog, DriverActivityLog, RouteActivityLog } = require('../models');

/**
 * Activity Service - Consolidated access to all activity logs
 */
class ActivityService {
    /**
     * Get all recent activity logs (combined)
     * @param {number} limit - Maximum number of records per type
     * @returns {Promise<object>} Activity logs by type
     */
    static async getAllRecent(limit = 50) {
        const [busLogs, driverLogs, routeLogs] = await Promise.all([
            BusActivityLog.findAll(limit),
            DriverActivityLog.findAll(limit),
            RouteActivityLog.findAll(limit),
        ]);

        return {
            bus: busLogs,
            driver: driverLogs,
            route: routeLogs,
        };
    }

    /**
     * Get combined activity timeline (all types merged and sorted)
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} Combined activity logs sorted by timestamp
     */
    static async getCombinedTimeline(limit = 100) {
        const [busLogs, driverLogs, routeLogs] = await Promise.all([
            BusActivityLog.findAll(limit),
            DriverActivityLog.findAll(limit),
            RouteActivityLog.findAll(limit),
        ]);

        // Add type to each log
        const allLogs = [
            ...busLogs.map(log => ({ ...log, entity_type: 'bus' })),
            ...driverLogs.map(log => ({ ...log, entity_type: 'driver' })),
            ...routeLogs.map(log => ({ ...log, entity_type: 'route' })),
        ];

        // Sort by timestamp descending
        allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Return limited results
        return allLogs.slice(0, limit);
    }

    /**
     * Get bus activity history
     * @param {string} busId - Bus UUID
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} Activity logs
     */
    static async getBusHistory(busId, limit = 100) {
        return BusActivityLog.findByBus(busId, limit);
    }

    /**
     * Get driver activity history
     * @param {string} driverId - Driver UUID
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} Activity logs
     */
    static async getDriverHistory(driverId, limit = 100) {
        return DriverActivityLog.findByDriver(driverId, limit);
    }

    /**
     * Get route activity history
     * @param {string} routeId - Route UUID
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} Activity logs
     */
    static async getRouteHistory(routeId, limit = 100) {
        return RouteActivityLog.findByRoute(routeId, limit);
    }

    /**
     * Get admin-forced activities only
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} Admin-forced activity logs
     */
    static async getAdminForcedActivities(limit = 100) {
        const timeline = await this.getCombinedTimeline(limit * 3);
        return timeline.filter(log => log.is_admin_forced).slice(0, limit);
    }
}

module.exports = ActivityService;
