const db = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * AdminUser Model - Database operations for admin users
 */
class AdminUser {
    /**
     * Find all admins
     * @returns {Promise<Array>} List of all admins (without password)
     */
    static async findAll() {
        const result = await db.query(
            'SELECT id, username, email, created_at, updated_at FROM admin_users ORDER BY username'
        );
        return result.rows;
    }

    /**
     * Find admin by ID
     * @param {string} id - Admin UUID
     * @returns {Promise<object|null>} Admin object or null
     */
    static async findById(id) {
        const result = await db.query(
            'SELECT id, username, email, created_at, updated_at FROM admin_users WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }

    /**
     * Find admin by username (includes password for auth)
     * @param {string} username - Username
     * @returns {Promise<object|null>} Admin object or null
     */
    static async findByUsername(username) {
        const result = await db.query(
            'SELECT * FROM admin_users WHERE username = $1',
            [username]
        );
        return result.rows[0] || null;
    }

    /**
     * Create a new admin
     * @param {object} adminData - Admin data
     * @returns {Promise<object>} Created admin (without password)
     */
    static async create(adminData) {
        const { username, password, email } = adminData;

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const result = await db.query(
            `INSERT INTO admin_users (username, password_hash, email) 
       VALUES ($1, $2, $3) 
       RETURNING id, username, email, created_at, updated_at`,
            [username, passwordHash, email]
        );
        return result.rows[0];
    }

    /**
     * Verify password
     * @param {string} plainPassword - Plain text password
     * @param {string} hashedPassword - Hashed password
     * @returns {Promise<boolean>} True if password matches
     */
    static async verifyPassword(plainPassword, hashedPassword) {
        return bcrypt.compare(plainPassword, hashedPassword);
    }

    /**
     * Update admin password
     * @param {string} id - Admin UUID
     * @param {string} newPassword - New plain text password
     * @returns {Promise<boolean>} True if updated
     */
    static async updatePassword(id, newPassword) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        const result = await db.query(
            'UPDATE admin_users SET password_hash = $1 WHERE id = $2',
            [passwordHash, id]
        );
        return result.rowCount > 0;
    }

    /**
     * Delete admin
     * @param {string} id - Admin UUID
     * @returns {Promise<boolean>} True if deleted
     */
    static async delete(id) {
        const result = await db.query('DELETE FROM admin_users WHERE id = $1', [id]);
        return result.rowCount > 0;
    }
}

module.exports = AdminUser;
