const { Bus, BusActivityLog, RouteAssignment } = require('../models');
const { BUS_STATUS, ACTIVITY_ACTIONS, SOCKET_EVENTS } = require('../utils/constants');
const { emitToAdmin } = require('../config/socket');
const logger = require('../utils/logger');
const db = require('../config/database');

/**
 * Bus Service - Business logic for bus operations
 */
class BusService {
    /**
     * Get all buses with their current assignments
     * @returns {Promise<Array>} List of buses
     */
    static async getAllWithAssignments() {
        const buses = await Bus.findAll();
        const result = [];

        for (const bus of buses) {
            const busWithDetails = await Bus.findWithAssignment(bus.id);
            result.push(busWithDetails);
        }

        return result;
    }

    /**
     * Get bus statistics
     * @returns {Promise<object>} Statistics
     */
    static async getStats() {
        return Bus.getStats();
    }

    /**
     * Send bus to maintenance (admin action)
     * @param {string} busId - Bus UUID
     * @param {string} adminId - Admin UUID
     * @returns {Promise<object>} Result
     */
    static async sendToMaintenance(busId, adminId) {
        logger.info(`Sending bus ${busId} to maintenance by admin ${adminId}`);

        return db.transaction(async (client) => {
            const bus = await Bus.findById(busId);
            if (!bus) {
                throw new Error(`Bus not found: ${busId}`);
            }

            if (bus.status === BUS_STATUS.MAINTENANCE) {
                return { success: true, message: 'Bus is already in maintenance' };
            }

            const previousStatus = bus.status;

            // If bus is running, end its assignment
            if (bus.status === BUS_STATUS.RUNNING) {
                const assignment = await RouteAssignment.findActiveByBus(busId);
                if (assignment) {
                    await RouteAssignment.endByBus(busId);

                    // Log route activity for the ended assignment
                    const { RouteActivityLog } = require('../models');
                    await RouteActivityLog.create({
                        routeId: assignment.route_id,
                        action: ACTIVITY_ACTIONS.ROUTE_ASSIGNMENT_ENDED,
                        relatedBusId: busId,
                        relatedDriverId: assignment.driver_id,
                        isAdminForced: true,
                        adminId,
                        details: { reason: 'Bus sent to maintenance' },
                    });
                }
            }

            // Update status
            await Bus.updateStatus(busId, BUS_STATUS.MAINTENANCE);

            // Log activity
            await BusActivityLog.create({
                busId,
                action: ACTIVITY_ACTIONS.BUS_SENT_TO_MAINTENANCE,
                previousStatus,
                newStatus: BUS_STATUS.MAINTENANCE,
                isAdminForced: true,
                adminId,
            });

            // Emit socket event
            emitToAdmin(SOCKET_EVENTS.BUS_STATUS_CHANGE, {
                busId,
                busNumber: bus.bus_number,
                previousStatus,
                newStatus: BUS_STATUS.MAINTENANCE,
                action: 'maintenance',
                adminId,
            });

            logger.info(`Bus ${bus.bus_number} sent to maintenance`);

            return {
                success: true,
                message: `Bus ${bus.bus_number} sent to maintenance`,
                bus: await Bus.findById(busId),
            };
        });
    }

    /**
     * Set bus status from maintenance to available (admin action)
     * @param {string} busId - Bus UUID
     * @param {string} adminId - Admin UUID
     * @returns {Promise<object>} Result
     */
    static async setAvailableFromMaintenance(busId, adminId) {
        logger.info(`Setting bus ${busId} available from maintenance by admin ${adminId}`);

        return db.transaction(async (client) => {
            const bus = await Bus.findById(busId);
            if (!bus) {
                throw new Error(`Bus not found: ${busId}`);
            }

            if (bus.status !== BUS_STATUS.MAINTENANCE) {
                throw new Error(`Bus ${bus.bus_number} is not in maintenance (current: ${bus.status})`);
            }

            // Update status
            await Bus.updateStatus(busId, BUS_STATUS.AVAILABLE);

            // Log activity
            await BusActivityLog.create({
                busId,
                action: ACTIVITY_ACTIONS.BUS_STATUS_CHANGE,
                previousStatus: BUS_STATUS.MAINTENANCE,
                newStatus: BUS_STATUS.AVAILABLE,
                isAdminForced: true,
                adminId,
                details: { reason: 'Released from maintenance' },
            });

            // Emit socket event
            emitToAdmin(SOCKET_EVENTS.BUS_STATUS_CHANGE, {
                busId,
                busNumber: bus.bus_number,
                previousStatus: BUS_STATUS.MAINTENANCE,
                newStatus: BUS_STATUS.AVAILABLE,
                action: 'available',
                adminId,
            });

            logger.info(`Bus ${bus.bus_number} set to available from maintenance`);

            return {
                success: true,
                message: `Bus ${bus.bus_number} is now available`,
                bus: await Bus.findById(busId),
            };
        });
    }

    /**
     * Set bus status from rest to available (admin action)
     * @param {string} busId - Bus UUID
     * @param {string} adminId - Admin UUID
     * @returns {Promise<object>} Result
     */
    static async setAvailableFromRest(busId, adminId) {
        logger.info(`Setting bus ${busId} available from rest by admin ${adminId}`);

        return db.transaction(async (client) => {
            const bus = await Bus.findById(busId);
            if (!bus) {
                throw new Error(`Bus not found: ${busId}`);
            }

            if (bus.status !== BUS_STATUS.REST) {
                throw new Error(`Bus ${bus.bus_number} is not at rest (current: ${bus.status})`);
            }

            // Update status
            await Bus.updateStatus(busId, BUS_STATUS.AVAILABLE);

            // Reset rounds since it's coming from rest
            await Bus.resetRounds(busId);

            // Log activity
            await BusActivityLog.create({
                busId,
                action: ACTIVITY_ACTIONS.BUS_STATUS_CHANGE,
                previousStatus: BUS_STATUS.REST,
                newStatus: BUS_STATUS.AVAILABLE,
                isAdminForced: true,
                adminId,
                details: { reason: 'Released from rest' },
            });

            // Emit socket event
            emitToAdmin(SOCKET_EVENTS.BUS_STATUS_CHANGE, {
                busId,
                busNumber: bus.bus_number,
                previousStatus: BUS_STATUS.REST,
                newStatus: BUS_STATUS.AVAILABLE,
                action: 'available',
                adminId,
            });

            logger.info(`Bus ${bus.bus_number} set to available from rest`);

            return {
                success: true,
                message: `Bus ${bus.bus_number} is now available`,
                bus: await Bus.findById(busId),
            };
        });
    }

    /**
     * Get bus activity history
     * @param {string} busId - Bus UUID
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} Activity logs
     */
    static async getActivityHistory(busId, limit = 100) {
        return BusActivityLog.findByBus(busId, limit);
    }

    /**
     * Get bus assignment history
     * @param {string} busId - Bus UUID
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} Assignment history
     */
    static async getAssignmentHistory(busId, limit = 50) {
        return RouteAssignment.getHistoryByBus(busId, limit);
    }
}

module.exports = BusService;
