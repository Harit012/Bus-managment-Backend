const db = require('../config/database');

/**
 * Activity Log Models - Database operations for activity logging
 */

/**
 * BusActivityLog - Logs bus-related activities
 */
class BusActivityLog {
    /**
     * Create a new bus activity log entry
     * @param {object} data - Log data
     * @returns {Promise<object>} Created log entry
     */
    static async create(data) {
        const {
            busId,
            action,
            previousStatus,
            newStatus,
            relatedRouteId = null,
            relatedDriverId = null,
            isAdminForced = false,
            adminId = null,
            details = null
        } = data;

        const result = await db.query(
            `INSERT INTO bus_activity_logs 
       (bus_id, action, previous_status, new_status, related_route_id, related_driver_id, is_admin_forced, admin_id, details) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
            [busId, action, previousStatus, newStatus, relatedRouteId, relatedDriverId, isAdminForced, adminId, details ? JSON.stringify(details) : null]
        );
        return result.rows[0];
    }

    /**
     * Get activity logs for a bus
     * @param {string} busId - Bus UUID
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} List of log entries
     */
    static async findByBus(busId, limit = 100) {
        const result = await db.query(`
      SELECT bal.*, 
             r.name as route_name,
             d.name as driver_name,
             au.username as admin_username
      FROM bus_activity_logs bal
      LEFT JOIN routes r ON bal.related_route_id = r.id
      LEFT JOIN drivers d ON bal.related_driver_id = d.id
      LEFT JOIN admin_users au ON bal.admin_id = au.id
      WHERE bal.bus_id = $1
      ORDER BY bal.timestamp DESC
      LIMIT $2
    `, [busId, limit]);
        return result.rows;
    }

    /**
     * Get all activity logs
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} List of log entries
     */
    static async findAll(limit = 100) {
        const result = await db.query(`
      SELECT bal.*, 
             b.bus_number,
             r.name as route_name,
             d.name as driver_name,
             au.username as admin_username
      FROM bus_activity_logs bal
      LEFT JOIN buses b ON bal.bus_id = b.id
      LEFT JOIN routes r ON bal.related_route_id = r.id
      LEFT JOIN drivers d ON bal.related_driver_id = d.id
      LEFT JOIN admin_users au ON bal.admin_id = au.id
      ORDER BY bal.timestamp DESC
      LIMIT $1
    `, [limit]);
        return result.rows;
    }
}

/**
 * DriverActivityLog - Logs driver-related activities
 */
class DriverActivityLog {
    /**
     * Create a new driver activity log entry
     * @param {object} data - Log data
     * @returns {Promise<object>} Created log entry
     */
    static async create(data) {
        const {
            driverId,
            action,
            previousStatus,
            newStatus,
            relatedRouteId = null,
            relatedBusId = null,
            isAdminForced = false,
            adminId = null,
            details = null
        } = data;

        const result = await db.query(
            `INSERT INTO driver_activity_logs 
       (driver_id, action, previous_status, new_status, related_route_id, related_bus_id, is_admin_forced, admin_id, details) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
            [driverId, action, previousStatus, newStatus, relatedRouteId, relatedBusId, isAdminForced, adminId, details ? JSON.stringify(details) : null]
        );
        return result.rows[0];
    }

    /**
     * Get activity logs for a driver
     * @param {string} driverId - Driver UUID
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} List of log entries
     */
    static async findByDriver(driverId, limit = 100) {
        const result = await db.query(`
      SELECT dal.*, 
             r.name as route_name,
             b.bus_number,
             au.username as admin_username
      FROM driver_activity_logs dal
      LEFT JOIN routes r ON dal.related_route_id = r.id
      LEFT JOIN buses b ON dal.related_bus_id = b.id
      LEFT JOIN admin_users au ON dal.admin_id = au.id
      WHERE dal.driver_id = $1
      ORDER BY dal.timestamp DESC
      LIMIT $2
    `, [driverId, limit]);
        return result.rows;
    }

    /**
     * Get all activity logs
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} List of log entries
     */
    static async findAll(limit = 100) {
        const result = await db.query(`
      SELECT dal.*, 
             d.name as driver_name,
             d.employee_id,
             r.name as route_name,
             b.bus_number,
             au.username as admin_username
      FROM driver_activity_logs dal
      LEFT JOIN drivers d ON dal.driver_id = d.id
      LEFT JOIN routes r ON dal.related_route_id = r.id
      LEFT JOIN buses b ON dal.related_bus_id = b.id
      LEFT JOIN admin_users au ON dal.admin_id = au.id
      ORDER BY dal.timestamp DESC
      LIMIT $1
    `, [limit]);
        return result.rows;
    }
}

/**
 * RouteActivityLog - Logs route-related activities
 */
class RouteActivityLog {
    /**
     * Create a new route activity log entry
     * @param {object} data - Log data
     * @returns {Promise<object>} Created log entry
     */
    static async create(data) {
        const {
            routeId,
            action,
            previousStatus,
            newStatus,
            relatedBusId = null,
            relatedDriverId = null,
            isAdminForced = false,
            adminId = null,
            details = null
        } = data;

        const result = await db.query(
            `INSERT INTO route_activity_logs 
       (route_id, action, previous_status, new_status, related_bus_id, related_driver_id, is_admin_forced, admin_id, details) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
            [routeId, action, previousStatus, newStatus, relatedBusId, relatedDriverId, isAdminForced, adminId, details ? JSON.stringify(details) : null]
        );
        return result.rows[0];
    }

    /**
     * Get activity logs for a route
     * @param {string} routeId - Route UUID
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} List of log entries
     */
    static async findByRoute(routeId, limit = 100) {
        const result = await db.query(`
      SELECT ral.*, 
             b.bus_number,
             d.name as driver_name,
             au.username as admin_username
      FROM route_activity_logs ral
      LEFT JOIN buses b ON ral.related_bus_id = b.id
      LEFT JOIN drivers d ON ral.related_driver_id = d.id
      LEFT JOIN admin_users au ON ral.admin_id = au.id
      WHERE ral.route_id = $1
      ORDER BY ral.timestamp DESC
      LIMIT $2
    `, [routeId, limit]);
        return result.rows;
    }

    /**
     * Get all activity logs
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} List of log entries
     */
    static async findAll(limit = 100) {
        const result = await db.query(`
      SELECT ral.*, 
             r.name as route_name,
             b.bus_number,
             d.name as driver_name,
             au.username as admin_username
      FROM route_activity_logs ral
      LEFT JOIN routes r ON ral.route_id = r.id
      LEFT JOIN buses b ON ral.related_bus_id = b.id
      LEFT JOIN drivers d ON ral.related_driver_id = d.id
      LEFT JOIN admin_users au ON ral.admin_id = au.id
      ORDER BY ral.timestamp DESC
      LIMIT $1
    `, [limit]);
        return result.rows;
    }
}

module.exports = {
    BusActivityLog,
    DriverActivityLog,
    RouteActivityLog,
};
