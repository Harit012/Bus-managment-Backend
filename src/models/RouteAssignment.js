const db = require('../config/database');

/**
 * RouteAssignment Model - Database operations for route assignments
 */
class RouteAssignment {
    /**
     * Find all assignments
     * @returns {Promise<Array>} List of all assignments
     */
    static async findAll() {
        const result = await db.query(`
      SELECT ra.*, 
             r.name as route_name,
             b.bus_number,
             d.name as driver_name
      FROM route_assignments ra
      LEFT JOIN routes r ON ra.route_id = r.id
      LEFT JOIN buses b ON ra.bus_id = b.id
      LEFT JOIN drivers d ON ra.driver_id = d.id
      ORDER BY ra.started_at DESC
    `);
        return result.rows;
    }

    /**
     * Find assignment by ID
     * @param {string} id - Assignment UUID
     * @returns {Promise<object|null>} Assignment object or null
     */
    static async findById(id) {
        const result = await db.query(`
      SELECT ra.*, 
             r.name as route_name,
             r.duration_minutes,
             b.bus_number,
             d.name as driver_name
      FROM route_assignments ra
      LEFT JOIN routes r ON ra.route_id = r.id
      LEFT JOIN buses b ON ra.bus_id = b.id
      LEFT JOIN drivers d ON ra.driver_id = d.id
      WHERE ra.id = $1
    `, [id]);
        return result.rows[0] || null;
    }

    /**
     * Find active assignment for a route
     * @param {string} routeId - Route UUID
     * @returns {Promise<object|null>} Active assignment or null
     */
    static async findActiveByRoute(routeId) {
        const result = await db.query(`
      SELECT ra.*, 
             r.name as route_name,
             r.duration_minutes,
             b.bus_number,
             b.status as bus_status,
             d.name as driver_name,
             d.status as driver_status
      FROM route_assignments ra
      LEFT JOIN routes r ON ra.route_id = r.id
      LEFT JOIN buses b ON ra.bus_id = b.id
      LEFT JOIN drivers d ON ra.driver_id = d.id
      WHERE ra.route_id = $1 AND ra.is_active = true
    `, [routeId]);
        return result.rows[0] || null;
    }

    /**
     * Find active assignment for a bus
     * @param {string} busId - Bus UUID
     * @returns {Promise<object|null>} Active assignment or null
     */
    static async findActiveByBus(busId) {
        const result = await db.query(`
      SELECT ra.*, 
             r.name as route_name,
             r.duration_minutes,
             d.name as driver_name
      FROM route_assignments ra
      LEFT JOIN routes r ON ra.route_id = r.id
      LEFT JOIN drivers d ON ra.driver_id = d.id
      WHERE ra.bus_id = $1 AND ra.is_active = true
    `, [busId]);
        return result.rows[0] || null;
    }

    /**
     * Find active assignment for a driver
     * @param {string} driverId - Driver UUID
     * @returns {Promise<object|null>} Active assignment or null
     */
    static async findActiveByDriver(driverId) {
        const result = await db.query(`
      SELECT ra.*, 
             r.name as route_name,
             r.duration_minutes,
             b.bus_number
      FROM route_assignments ra
      LEFT JOIN routes r ON ra.route_id = r.id
      LEFT JOIN buses b ON ra.bus_id = b.id
      WHERE ra.driver_id = $1 AND ra.is_active = true
    `, [driverId]);
        return result.rows[0] || null;
    }

    /**
     * Find all active assignments
     * @returns {Promise<Array>} List of active assignments
     */
    static async findAllActive() {
        const result = await db.query(`
      SELECT ra.*, 
             r.name as route_name,
             r.duration_minutes,
             b.bus_number,
             b.status as bus_status,
             d.name as driver_name,
             d.status as driver_status
      FROM route_assignments ra
      LEFT JOIN routes r ON ra.route_id = r.id
      LEFT JOIN buses b ON ra.bus_id = b.id
      LEFT JOIN drivers d ON ra.driver_id = d.id
      WHERE ra.is_active = true
      ORDER BY ra.started_at DESC
    `);
        return result.rows;
    }

    /**
     * Create a new assignment
     * @param {object} data - Assignment data
     * @returns {Promise<object>} Created assignment
     */
    static async create(data) {
        const {
            routeId,
            busId,
            driverId,
            isForced = false,
            forcedByAdminId = null,
            roundNumber = 1
        } = data;

        const result = await db.query(
            `INSERT INTO route_assignments 
       (route_id, bus_id, driver_id, is_forced, forced_by_admin_id, round_number, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, true) 
       RETURNING *`,
            [routeId, busId, driverId, isForced, forcedByAdminId, roundNumber]
        );
        return result.rows[0];
    }

    /**
     * End an assignment
     * @param {string} id - Assignment UUID
     * @returns {Promise<object>} Updated assignment
     */
    static async end(id) {
        const result = await db.query(
            `UPDATE route_assignments 
       SET is_active = false, ended_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING *`,
            [id]
        );
        return result.rows[0];
    }

    /**
     * End active assignment for a bus
     * @param {string} busId - Bus UUID
     * @returns {Promise<object|null>} Ended assignment or null
     */
    static async endByBus(busId) {
        const result = await db.query(
            `UPDATE route_assignments 
       SET is_active = false, ended_at = CURRENT_TIMESTAMP 
       WHERE bus_id = $1 AND is_active = true
       RETURNING *`,
            [busId]
        );
        return result.rows[0] || null;
    }

    /**
     * End active assignment for a driver
     * @param {string} driverId - Driver UUID
     * @returns {Promise<object|null>} Ended assignment or null
     */
    static async endByDriver(driverId) {
        const result = await db.query(
            `UPDATE route_assignments 
       SET is_active = false, ended_at = CURRENT_TIMESTAMP 
       WHERE driver_id = $1 AND is_active = true
       RETURNING *`,
            [driverId]
        );
        return result.rows[0] || null;
    }

    /**
     * End active assignment for a route
     * @param {string} routeId - Route UUID
     * @returns {Promise<object|null>} Ended assignment or null
     */
    static async endByRoute(routeId) {
        const result = await db.query(
            `UPDATE route_assignments 
       SET is_active = false, ended_at = CURRENT_TIMESTAMP 
       WHERE route_id = $1 AND is_active = true
       RETURNING *`,
            [routeId]
        );
        return result.rows[0] || null;
    }

    /**
     * Update bus in assignment
     * @param {string} id - Assignment UUID
     * @param {string} busId - New bus UUID
     * @param {boolean} isForced - Whether this is a forced assignment
     * @param {string|null} adminId - Admin ID if forced
     * @returns {Promise<object>} Updated assignment
     */
    static async updateBus(id, busId, isForced = false, adminId = null) {
        const result = await db.query(
            `UPDATE route_assignments 
       SET bus_id = $1, is_forced = $2, forced_by_admin_id = $3
       WHERE id = $4 
       RETURNING *`,
            [busId, isForced, adminId, id]
        );
        return result.rows[0];
    }

    /**
     * Update driver in assignment
     * @param {string} id - Assignment UUID
     * @param {string} driverId - New driver UUID
     * @param {boolean} isForced - Whether this is a forced assignment
     * @param {string|null} adminId - Admin ID if forced
     * @returns {Promise<object>} Updated assignment
     */
    static async updateDriver(id, driverId, isForced = false, adminId = null) {
        const result = await db.query(
            `UPDATE route_assignments 
       SET driver_id = $1, is_forced = $2, forced_by_admin_id = $3
       WHERE id = $4 
       RETURNING *`,
            [driverId, isForced, adminId, id]
        );
        return result.rows[0];
    }

    /**
     * Get assignment history for a route
     * @param {string} routeId - Route UUID
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} List of assignments
     */
    static async getHistoryByRoute(routeId, limit = 50) {
        const result = await db.query(`
      SELECT ra.*, 
             b.bus_number,
             d.name as driver_name,
             au.username as forced_by_admin
      FROM route_assignments ra
      LEFT JOIN buses b ON ra.bus_id = b.id
      LEFT JOIN drivers d ON ra.driver_id = d.id
      LEFT JOIN admin_users au ON ra.forced_by_admin_id = au.id
      WHERE ra.route_id = $1
      ORDER BY ra.started_at DESC
      LIMIT $2
    `, [routeId, limit]);
        return result.rows;
    }

    /**
     * Get assignment history for a bus
     * @param {string} busId - Bus UUID
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} List of assignments
     */
    static async getHistoryByBus(busId, limit = 50) {
        const result = await db.query(`
      SELECT ra.*, 
             r.name as route_name,
             d.name as driver_name,
             au.username as forced_by_admin
      FROM route_assignments ra
      LEFT JOIN routes r ON ra.route_id = r.id
      LEFT JOIN drivers d ON ra.driver_id = d.id
      LEFT JOIN admin_users au ON ra.forced_by_admin_id = au.id
      WHERE ra.bus_id = $1
      ORDER BY ra.started_at DESC
      LIMIT $2
    `, [busId, limit]);
        return result.rows;
    }

    /**
     * Get assignment history for a driver
     * @param {string} driverId - Driver UUID
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} List of assignments
     */
    static async getHistoryByDriver(driverId, limit = 50) {
        const result = await db.query(`
      SELECT ra.*, 
             r.name as route_name,
             b.bus_number,
             au.username as forced_by_admin
      FROM route_assignments ra
      LEFT JOIN routes r ON ra.route_id = r.id
      LEFT JOIN buses b ON ra.bus_id = b.id
      LEFT JOIN admin_users au ON ra.forced_by_admin_id = au.id
      WHERE ra.driver_id = $1
      ORDER BY ra.started_at DESC
      LIMIT $2
    `, [driverId, limit]);
        return result.rows;
    }
}

module.exports = RouteAssignment;
