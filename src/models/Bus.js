const db = require('../config/database');
const { BUS_STATUS } = require('../utils/constants');

/**
 * Bus Model - Database operations for buses
 */
class Bus {
    /**
     * Find all buses
     * @returns {Promise<Array>} List of all buses
     */
    static async findAll() {
        const result = await db.query('SELECT * FROM buses ORDER BY bus_number');
        return result.rows;
    }

    /**
     * Find bus by ID
     * @param {string} id - Bus UUID
     * @returns {Promise<object|null>} Bus object or null
     */
    static async findById(id) {
        const result = await db.query('SELECT * FROM buses WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    /**
     * Find bus by bus number
     * @param {string} busNumber - Bus number (e.g., "BUS-001")
     * @returns {Promise<object|null>} Bus object or null
     */
    static async findByNumber(busNumber) {
        const result = await db.query('SELECT * FROM buses WHERE bus_number = $1', [busNumber]);
        return result.rows[0] || null;
    }

    /**
     * Find buses by status
     * @param {string} status - Bus status
     * @returns {Promise<Array>} List of buses with given status
     */
    static async findByStatus(status) {
        const result = await db.query(
            'SELECT * FROM buses WHERE status = $1 ORDER BY bus_number',
            [status]
        );
        return result.rows;
    }

    /**
     * Find all available buses that can do another round
     * @returns {Promise<Array>} List of available buses
     */
    static async findAvailable() {
        const result = await db.query(
            `SELECT * FROM buses 
       WHERE status = $1 AND rounds_today < 3
       ORDER BY rounds_today ASC, bus_number`,
            [BUS_STATUS.AVAILABLE]
        );
        return result.rows;
    }

    /**
     * Create a new bus
     * @param {object} busData - Bus data
     * @returns {Promise<object>} Created bus
     */
    static async create(busData) {
        const { busNumber, status = BUS_STATUS.AVAILABLE } = busData;
        const result = await db.query(
            `INSERT INTO buses (bus_number, status) 
       VALUES ($1, $2) 
       RETURNING *`,
            [busNumber, status]
        );
        return result.rows[0];
    }

    /**
     * Update bus status
     * @param {string} id - Bus UUID
     * @param {string} status - New status
     * @returns {Promise<object>} Updated bus
     */
    static async updateStatus(id, status) {
        const result = await db.query(
            `UPDATE buses SET status = $1 WHERE id = $2 RETURNING *`,
            [status, id]
        );
        return result.rows[0];
    }

    /**
     * Increment bus rounds for today
     * @param {string} id - Bus UUID
     * @returns {Promise<object>} Updated bus
     */
    static async incrementRounds(id) {
        const result = await db.query(
            `UPDATE buses 
       SET rounds_today = rounds_today + 1 
       WHERE id = $1 
       RETURNING *`,
            [id]
        );
        return result.rows[0];
    }

    /**
     * Reset bus rounds for today
     * @param {string} id - Bus UUID
     * @returns {Promise<object>} Updated bus
     */
    static async resetRounds(id) {
        const result = await db.query(
            `UPDATE buses 
       SET rounds_today = 0 
       WHERE id = $1 
       RETURNING *`,
            [id]
        );
        return result.rows[0];
    }

    /**
     * Reset daily counters for all buses
     * @returns {Promise<number>} Number of buses updated
     */
    static async resetDailyCounters() {
        const result = await db.query(
            `UPDATE buses 
       SET rounds_today = 0, last_round_reset_date = CURRENT_DATE
       WHERE last_round_reset_date < CURRENT_DATE
       RETURNING id`
        );
        return result.rowCount;
    }

    /**
     * Get bus statistics
     * @returns {Promise<object>} Statistics object
     */
    static async getStats() {
        const result = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'AVAILABLE') as available,
        COUNT(*) FILTER (WHERE status = 'RUNNING') as running,
        COUNT(*) FILTER (WHERE status = 'REST') as rest,
        COUNT(*) FILTER (WHERE status = 'MAINTENANCE') as maintenance,
        COUNT(*) as total
      FROM buses
    `);
        return result.rows[0];
    }

    /**
     * Get bus with current assignment
     * @param {string} id - Bus UUID
     * @returns {Promise<object|null>} Bus with assignment details
     */
    static async findWithAssignment(id) {
        const result = await db.query(`
      SELECT b.*, 
             ra.id as assignment_id,
             ra.route_id,
             ra.driver_id,
             ra.started_at as assignment_started_at,
             r.name as route_name,
             d.name as driver_name
      FROM buses b
      LEFT JOIN route_assignments ra ON b.id = ra.bus_id AND ra.is_active = true
      LEFT JOIN routes r ON ra.route_id = r.id
      LEFT JOIN drivers d ON ra.driver_id = d.id
      WHERE b.id = $1
    `, [id]);
        return result.rows[0] || null;
    }
}

module.exports = Bus;
