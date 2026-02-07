const db = require('../config/database');
const { DRIVER_STATUS } = require('../utils/constants');
const config = require('../config/env');

/**
 * Driver Model - Database operations for drivers
 */
class Driver {
    /**
     * Find all drivers
     * @returns {Promise<Array>} List of all drivers
     */
    static async findAll() {
        const result = await db.query('SELECT * FROM drivers ORDER BY name');
        return result.rows;
    }

    /**
     * Find driver by ID
     * @param {string} id - Driver UUID
     * @returns {Promise<object|null>} Driver object or null
     */
    static async findById(id) {
        const result = await db.query('SELECT * FROM drivers WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    /**
     * Find driver by employee ID
     * @param {string} employeeId - Employee ID
     * @returns {Promise<object|null>} Driver object or null
     */
    static async findByEmployeeId(employeeId) {
        const result = await db.query('SELECT * FROM drivers WHERE employee_id = $1', [employeeId]);
        return result.rows[0] || null;
    }

    /**
     * Find drivers by status
     * @param {string} status - Driver status
     * @returns {Promise<Array>} List of drivers with given status
     */
    static async findByStatus(status) {
        const result = await db.query(
            'SELECT * FROM drivers WHERE status = $1 ORDER BY name',
            [status]
        );
        return result.rows;
    }

    /**
     * Find available drivers that can work for given route duration
     * @param {number} routeDuration - Route duration in minutes
     * @returns {Promise<Array>} List of available drivers
     */
    static async findAvailableForDuration(routeDuration) {
        const maxMinutes = config.RULES.MAX_DRIVER_MINUTES_PER_DAY;
        const result = await db.query(
            `SELECT * FROM drivers 
       WHERE status = $1 
       AND (worked_minutes_today + $2) <= $3
       ORDER BY worked_minutes_today ASC, name`,
            [DRIVER_STATUS.AVAILABLE, routeDuration, maxMinutes]
        );
        return result.rows;
    }

    /**
     * Find first available driver for route
     * @param {number} routeDuration - Route duration in minutes
     * @returns {Promise<object|null>} Available driver or null
     */
    static async findFirstAvailable(routeDuration) {
        const drivers = await this.findAvailableForDuration(routeDuration);
        return drivers[0] || null;
    }

    /**
     * Create a new driver
     * @param {object} driverData - Driver data
     * @returns {Promise<object>} Created driver
     */
    static async create(driverData) {
        const { name, employeeId, licenseNumber, phone, status = DRIVER_STATUS.AVAILABLE } = driverData;
        const result = await db.query(
            `INSERT INTO drivers (name, employee_id, license_number, phone, status) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
            [name, employeeId, licenseNumber, phone, status]
        );
        return result.rows[0];
    }

    /**
     * Update driver status
     * @param {string} id - Driver UUID
     * @param {string} status - New status
     * @returns {Promise<object>} Updated driver
     */
    static async updateStatus(id, status) {
        const result = await db.query(
            `UPDATE drivers SET status = $1 WHERE id = $2 RETURNING *`,
            [status, id]
        );
        return result.rows[0];
    }

    /**
     * Add worked minutes to driver
     * @param {string} id - Driver UUID
     * @param {number} minutes - Minutes to add
     * @returns {Promise<object>} Updated driver
     */
    static async addWorkedMinutes(id, minutes) {
        const result = await db.query(
            `UPDATE drivers 
       SET worked_minutes_today = worked_minutes_today + $1 
       WHERE id = $2 
       RETURNING *`,
            [minutes, id]
        );
        return result.rows[0];
    }

    /**
     * Get remaining work minutes for driver
     * @param {string} id - Driver UUID
     * @returns {Promise<number>} Remaining minutes
     */
    static async getRemainingMinutes(id) {
        const driver = await this.findById(id);
        if (!driver) return 0;
        return Math.max(0, config.RULES.MAX_DRIVER_MINUTES_PER_DAY - driver.worked_minutes_today);
    }

    /**
     * Reset daily counters for all drivers
     * @returns {Promise<number>} Number of drivers updated
     */
    static async resetDailyCounters() {
        const result = await db.query(
            `UPDATE drivers 
       SET worked_minutes_today = 0, last_work_reset_date = CURRENT_DATE
       WHERE last_work_reset_date < CURRENT_DATE
       RETURNING id`
        );
        return result.rowCount;
    }

    /**
     * Get driver statistics
     * @returns {Promise<object>} Statistics object
     */
    static async getStats() {
        const result = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'AVAILABLE') as available,
        COUNT(*) FILTER (WHERE status = 'RUNNING') as running,
        COUNT(*) FILTER (WHERE status = 'OFF_DUTY') as off_duty,
        COUNT(*) as total
      FROM drivers
    `);
        return result.rows[0];
    }

    /**
     * Get driver with current assignment
     * @param {string} id - Driver UUID
     * @returns {Promise<object|null>} Driver with assignment details
     */
    static async findWithAssignment(id) {
        const result = await db.query(`
      SELECT d.*, 
             ra.id as assignment_id,
             ra.route_id,
             ra.bus_id,
             ra.started_at as assignment_started_at,
             r.name as route_name,
             b.bus_number
      FROM drivers d
      LEFT JOIN route_assignments ra ON d.id = ra.driver_id AND ra.is_active = true
      LEFT JOIN routes r ON ra.route_id = r.id
      LEFT JOIN buses b ON ra.bus_id = b.id
      WHERE d.id = $1
    `, [id]);
        return result.rows[0] || null;
    }
}

module.exports = Driver;
