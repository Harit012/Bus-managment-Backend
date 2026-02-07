const db = require('../config/database');
const { ROUTE_STATUS } = require('../utils/constants');

/**
 * Route Model - Database operations for routes
 */
class Route {
    /**
     * Find all routes
     * @returns {Promise<Array>} List of all routes
     */
    static async findAll() {
        const result = await db.query('SELECT * FROM routes ORDER BY name');
        return result.rows;
    }

    /**
     * Find route by ID
     * @param {string} id - Route UUID
     * @returns {Promise<object|null>} Route object or null
     */
    static async findById(id) {
        const result = await db.query('SELECT * FROM routes WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    /**
     * Find routes by status
     * @param {string} status - Route status
     * @returns {Promise<Array>} List of routes with given status
     */
    static async findByStatus(status) {
        const result = await db.query(
            'SELECT * FROM routes WHERE status = $1 ORDER BY name',
            [status]
        );
        return result.rows;
    }

    /**
     * Find all active routes
     * @returns {Promise<Array>} List of active routes
     */
    static async findActive() {
        return this.findByStatus(ROUTE_STATUS.ACTIVE);
    }

    /**
     * Find active routes with their assignments
     * @returns {Promise<Array>} List of active routes with assignments
     */
    static async findActiveWithAssignments() {
        const result = await db.query(`
      SELECT r.*, 
             ra.id as assignment_id,
             ra.bus_id,
             ra.driver_id,
             ra.is_forced,
             ra.forced_by_admin_id,
             ra.started_at as assignment_started_at,
             ra.round_number,
             b.bus_number,
             b.status as bus_status,
             d.name as driver_name,
             d.status as driver_status
      FROM routes r
      LEFT JOIN route_assignments ra ON r.id = ra.route_id AND ra.is_active = true
      LEFT JOIN buses b ON ra.bus_id = b.id
      LEFT JOIN drivers d ON ra.driver_id = d.id
      WHERE r.status = $1
      ORDER BY r.name
    `, [ROUTE_STATUS.ACTIVE]);
        return result.rows;
    }

    /**
     * Create a new route
     * @param {object} routeData - Route data
     * @returns {Promise<object>} Created route
     */
    static async create(routeData) {
        const { name, startPoint, endPoint, durationMinutes, status = ROUTE_STATUS.ACTIVE } = routeData;
        const result = await db.query(
            `INSERT INTO routes (name, start_point, end_point, duration_minutes, status) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
            [name, startPoint, endPoint, durationMinutes, status]
        );
        return result.rows[0];
    }

    /**
     * Update route status
     * @param {string} id - Route UUID
     * @param {string} status - New status
     * @returns {Promise<object>} Updated route
     */
    static async updateStatus(id, status) {
        const result = await db.query(
            `UPDATE routes SET status = $1 WHERE id = $2 RETURNING *`,
            [status, id]
        );
        return result.rows[0];
    }

    /**
     * Update route details
     * @param {string} id - Route UUID
     * @param {object} data - Route data to update
     * @returns {Promise<object>} Updated route
     */
    static async update(id, data) {
        const { name, startPoint, endPoint, durationMinutes } = data;
        const result = await db.query(
            `UPDATE routes 
       SET name = COALESCE($1, name),
           start_point = COALESCE($2, start_point),
           end_point = COALESCE($3, end_point),
           duration_minutes = COALESCE($4, duration_minutes)
       WHERE id = $5 
       RETURNING *`,
            [name, startPoint, endPoint, durationMinutes, id]
        );
        return result.rows[0];
    }

    /**
     * Get active route count
     * @returns {Promise<number>} Number of active routes
     */
    static async getCount() {
        const result = await db.query("SELECT COUNT(*) FROM routes WHERE status = 'ACTIVE'");
        return parseInt(result.rows[0].count, 10);
    }

    /**
     * Delete a route
     * @param {string} id - Route UUID
     * @returns {Promise<object|null>} Deleted route or null
     */
    static async delete(id) {
        const result = await db.query('DELETE FROM routes WHERE id = $1 RETURNING *', [id]);
        return result.rows[0] || null;
    }

    /**
     * Get route statistics
     * @returns {Promise<object>} Statistics object
     */
    static async getStats() {
        const result = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
        COUNT(*) as total
      FROM routes
    `);
        return result.rows[0];
    }

    /**
     * Get route with full assignment details
     * @param {string} id - Route UUID
     * @returns {Promise<object|null>} Route with full details
     */
    static async findWithFullDetails(id) {
        const result = await db.query(`
      SELECT r.*, 
             ra.id as assignment_id,
             ra.bus_id,
             ra.driver_id,
             ra.is_forced,
             ra.forced_by_admin_id,
             ra.started_at as assignment_started_at,
             ra.round_number,
             ra.is_active as assignment_active,
             b.bus_number,
             b.status as bus_status,
             b.rounds_today as bus_rounds_today,
             d.name as driver_name,
             d.employee_id as driver_employee_id,
             d.status as driver_status,
             d.worked_minutes_today as driver_worked_minutes,
             au.username as forced_by_admin_username
      FROM routes r
      LEFT JOIN route_assignments ra ON r.id = ra.route_id AND ra.is_active = true
      LEFT JOIN buses b ON ra.bus_id = b.id
      LEFT JOIN drivers d ON ra.driver_id = d.id
      LEFT JOIN admin_users au ON ra.forced_by_admin_id = au.id
      WHERE r.id = $1
    `, [id]);
        return result.rows[0] || null;
    }
}

module.exports = Route;
