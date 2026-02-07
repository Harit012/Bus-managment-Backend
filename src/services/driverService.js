const { Driver, DriverActivityLog, RouteAssignment } = require('../models');
const { DRIVER_STATUS, ACTIVITY_ACTIONS, SOCKET_EVENTS } = require('../utils/constants');
const { emitToAdmin } = require('../config/socket');
const logger = require('../utils/logger');
const db = require('../config/database');

/**
 * Driver Service - Business logic for driver operations
 */
class DriverService {
    /**
     * Get all drivers with their current assignments
     * @returns {Promise<Array>} List of drivers
     */
    static async getAllWithAssignments() {
        const drivers = await Driver.findAll();
        const result = [];

        for (const driver of drivers) {
            const driverWithDetails = await Driver.findWithAssignment(driver.id);
            result.push(driverWithDetails);
        }

        return result;
    }

    /**
     * Get driver statistics
     * @returns {Promise<object>} Statistics
     */
    static async getStats() {
        return Driver.getStats();
    }

    /**
     * Set driver to OFF_DUTY (admin action)
     * @param {string} driverId - Driver UUID
     * @param {string} adminId - Admin UUID
     * @returns {Promise<object>} Result
     */
    static async setOffDuty(driverId, adminId) {
        logger.info(`Setting driver ${driverId} to OFF_DUTY by admin ${adminId}`);

        return db.transaction(async (client) => {
            const driver = await Driver.findById(driverId);
            if (!driver) {
                throw new Error(`Driver not found: ${driverId}`);
            }

            if (driver.status === DRIVER_STATUS.OFF_DUTY) {
                return { success: true, message: 'Driver is already OFF_DUTY' };
            }

            const previousStatus = driver.status;

            // If driver is running, end their assignment
            if (driver.status === DRIVER_STATUS.RUNNING) {
                const assignment = await RouteAssignment.findActiveByDriver(driverId);
                if (assignment) {
                    await RouteAssignment.endByDriver(driverId);

                    // Log route activity
                    const { RouteActivityLog } = require('../models');
                    await RouteActivityLog.create({
                        routeId: assignment.route_id,
                        action: ACTIVITY_ACTIONS.ROUTE_ASSIGNMENT_ENDED,
                        relatedBusId: assignment.bus_id,
                        relatedDriverId: driverId,
                        isAdminForced: true,
                        adminId,
                        details: { reason: 'Driver set to OFF_DUTY' },
                    });
                }
            }

            // Update status
            await Driver.updateStatus(driverId, DRIVER_STATUS.OFF_DUTY);

            // Log activity
            await DriverActivityLog.create({
                driverId,
                action: ACTIVITY_ACTIONS.DRIVER_WENT_OFF_DUTY,
                previousStatus,
                newStatus: DRIVER_STATUS.OFF_DUTY,
                isAdminForced: true,
                adminId,
            });

            // Emit socket event
            emitToAdmin(SOCKET_EVENTS.DRIVER_STATUS_CHANGE, {
                driverId,
                driverName: driver.name,
                previousStatus,
                newStatus: DRIVER_STATUS.OFF_DUTY,
                action: 'off_duty',
                adminId,
            });

            logger.info(`Driver ${driver.name} set to OFF_DUTY`);

            return {
                success: true,
                message: `Driver ${driver.name} set to OFF_DUTY`,
                driver: await Driver.findById(driverId),
            };
        });
    }

    /**
     * Set driver to AVAILABLE (admin action)
     * @param {string} driverId - Driver UUID
     * @param {string} adminId - Admin UUID
     * @returns {Promise<object>} Result
     */
    static async setAvailable(driverId, adminId) {
        logger.info(`Setting driver ${driverId} to AVAILABLE by admin ${adminId}`);

        return db.transaction(async (client) => {
            const driver = await Driver.findById(driverId);
            if (!driver) {
                throw new Error(`Driver not found: ${driverId}`);
            }

            if (driver.status === DRIVER_STATUS.AVAILABLE) {
                return { success: true, message: 'Driver is already AVAILABLE' };
            }

            if (driver.status === DRIVER_STATUS.RUNNING) {
                throw new Error(`Driver ${driver.name} is currently RUNNING - cannot set to available`);
            }

            const previousStatus = driver.status;

            // Update status
            await Driver.updateStatus(driverId, DRIVER_STATUS.AVAILABLE);

            // Log activity
            await DriverActivityLog.create({
                driverId,
                action: ACTIVITY_ACTIONS.DRIVER_STATUS_CHANGE,
                previousStatus,
                newStatus: DRIVER_STATUS.AVAILABLE,
                isAdminForced: true,
                adminId,
                details: { reason: 'Set available by admin' },
            });

            // Emit socket event
            emitToAdmin(SOCKET_EVENTS.DRIVER_STATUS_CHANGE, {
                driverId,
                driverName: driver.name,
                previousStatus,
                newStatus: DRIVER_STATUS.AVAILABLE,
                action: 'available',
                adminId,
            });

            logger.info(`Driver ${driver.name} set to AVAILABLE`);

            return {
                success: true,
                message: `Driver ${driver.name} is now AVAILABLE`,
                driver: await Driver.findById(driverId),
            };
        });
    }

    /**
     * Reset driver work hours (admin action for new day)
     * @param {string} driverId - Driver UUID
     * @param {string} adminId - Admin UUID
     * @returns {Promise<object>} Result
     */
    static async resetWorkHours(driverId, adminId) {
        logger.info(`Resetting work hours for driver ${driverId} by admin ${adminId}`);

        const driver = await Driver.findById(driverId);
        if (!driver) {
            throw new Error(`Driver not found: ${driverId}`);
        }

        await db.query(
            'UPDATE drivers SET worked_minutes_today = 0 WHERE id = $1',
            [driverId]
        );

        // Log activity
        await DriverActivityLog.create({
            driverId,
            action: ACTIVITY_ACTIONS.DRIVER_STATUS_CHANGE,
            previousStatus: driver.status,
            newStatus: driver.status,
            isAdminForced: true,
            adminId,
            details: {
                reason: 'Work hours reset',
                previousWorkedMinutes: driver.worked_minutes_today,
            },
        });

        logger.info(`Work hours reset for driver ${driver.name}`);

        return {
            success: true,
            message: `Work hours reset for driver ${driver.name}`,
            driver: await Driver.findById(driverId),
        };
    }

    /**
     * Get driver activity history
     * @param {string} driverId - Driver UUID
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} Activity logs
     */
    static async getActivityHistory(driverId, limit = 100) {
        return DriverActivityLog.findByDriver(driverId, limit);
    }

    /**
     * Get driver assignment history
     * @param {string} driverId - Driver UUID
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} Assignment history
     */
    static async getAssignmentHistory(driverId, limit = 50) {
        return RouteAssignment.getHistoryByDriver(driverId, limit);
    }
}

module.exports = DriverService;
