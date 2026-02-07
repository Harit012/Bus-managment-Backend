const { Route, RouteActivityLog, RouteAssignment } = require('../models');
const { ROUTE_STATUS, ACTIVITY_ACTIONS, SOCKET_EVENTS } = require('../utils/constants');
const { emitToAdmin } = require('../config/socket');
const logger = require('../utils/logger');
const db = require('../config/database');
const config = require('../config/env');

/**
 * Route Service - Business logic for route operations
 */
class RouteService {
    /**
     * Get all routes
     * @returns {Promise<Array>} List of routes
     */
    static async getAll() {
        return Route.findAll();
    }

    /**
     * Get all active routes with their assignments
     * @returns {Promise<Array>} List of active routes with assignments
     */
    static async getActiveWithAssignments() {
        return Route.findActiveWithAssignments();
    }

    /**
     * Get route with full details
     * @param {string} routeId - Route UUID
     * @returns {Promise<object|null>} Route with details
     */
    static async getWithDetails(routeId) {
        return Route.findWithFullDetails(routeId);
    }

    /**
     * Get route statistics
     * @returns {Promise<object>} Statistics
     */
    static async getStats() {
        return Route.getStats();
    }

    /**
     * Create a new route
     * @param {object} routeData - Route data
     * @returns {Promise<object>} Created route
     * @throws {Error} If max routes limit reached
     */
    static async create(routeData) {
        // Check max routes limit
        const currentCount = await Route.getCount();
        if (currentCount >= config.RULES.MAX_ROUTES) {
            throw new Error(`Maximum routes limit (${config.RULES.MAX_ROUTES}) reached. Delete or complete an existing route before creating a new one.`);
        }

        logger.info(`Creating new route: ${routeData.name}`);

        const route = await Route.create(routeData);

        // Log activity
        await RouteActivityLog.create({
            routeId: route.id,
            action: 'ROUTE_CREATED',
            newStatus: route.status,
        });

        // Emit socket event
        emitToAdmin(SOCKET_EVENTS.ROUTE_ASSIGNMENT_CHANGE, {
            action: 'created',
            routeId: route.id,
            routeName: route.name,
        });

        return route;
    }

    /**
     * Delete a route
     * @param {string} routeId - Route UUID
     * @param {string} adminId - Admin UUID
     * @returns {Promise<object>} Result
     */
    static async delete(routeId, adminId) {
        logger.info(`Deleting route: ${routeId}`);

        const route = await Route.findById(routeId);
        if (!route) {
            throw new Error(`Route not found: ${routeId}`);
        }

        // End any active assignment first
        const assignment = await RouteAssignment.findActiveByRoute(routeId);
        if (assignment) {
            const { AssignmentService } = require('./assignmentService');

            // Unassign bus and driver (this handles status updates, logging, and sockets)
            if (assignment.bus_id) {
                await AssignmentService.unassignBus(assignment.bus_id, 'AVAILABLE');
            }
            if (assignment.driver_id) {
                await AssignmentService.unassignDriver(assignment.driver_id, 'AVAILABLE');
            }
        }

        // Delete the route (cascade will handle related records)
        await Route.delete(routeId);

        // Emit socket event
        emitToAdmin(SOCKET_EVENTS.ROUTE_ASSIGNMENT_CHANGE, {
            action: 'deleted',
            routeId,
            routeName: route.name,
        });

        logger.info(`Route ${route.name} deleted by admin ${adminId}`);

        return {
            success: true,
            message: `Route "${route.name}" deleted successfully`,
        };
    }

    /**
     * Update route details
     * @param {string} routeId - Route UUID
     * @param {object} data - Route data to update
     * @returns {Promise<object>} Updated route
     */
    static async update(routeId, data) {
        const route = await Route.findById(routeId);
        if (!route) {
            throw new Error(`Route not found: ${routeId}`);
        }

        const updatedRoute = await Route.update(routeId, data);

        logger.info(`Updated route: ${route.name}`);

        return updatedRoute;
    }

    /**
     * Set route status to COMPLETED
     * @param {string} routeId - Route UUID
     * @param {string} adminId - Admin UUID (optional)
     * @returns {Promise<object>} Result
     */
    static async complete(routeId, adminId = null) {
        logger.info(`Completing route: ${routeId}`);

        return db.transaction(async (client) => {
            const route = await Route.findById(routeId);
            if (!route) {
                throw new Error(`Route not found: ${routeId}`);
            }

            if (route.status === ROUTE_STATUS.COMPLETED) {
                return { success: true, message: 'Route is already completed' };
            }

            // End any active assignment
            const assignment = await RouteAssignment.findActiveByRoute(routeId);
            if (assignment) {
                const { AssignmentService } = require('./assignmentService');

                // Unassign bus and driver (this handles status updates, logging, and sockets)
                if (assignment.bus_id) {
                    await AssignmentService.unassignBus(assignment.bus_id, 'AVAILABLE');
                }
                if (assignment.driver_id) {
                    await AssignmentService.unassignDriver(assignment.driver_id, 'AVAILABLE');
                }
            }

            // Update route status
            await Route.updateStatus(routeId, ROUTE_STATUS.COMPLETED);

            // Log activity
            await RouteActivityLog.create({
                routeId,
                action: ACTIVITY_ACTIONS.ROUTE_COMPLETED,
                previousStatus: ROUTE_STATUS.ACTIVE,
                newStatus: ROUTE_STATUS.COMPLETED,
                relatedBusId: assignment?.bus_id,
                relatedDriverId: assignment?.driver_id,
                isAdminForced: !!adminId,
                adminId,
            });

            // Emit socket event
            emitToAdmin(SOCKET_EVENTS.ROUTE_ASSIGNMENT_CHANGE, {
                action: 'completed',
                routeId,
                routeName: route.name,
            });

            logger.info(`Route ${route.name} completed`);

            return {
                success: true,
                message: `Route ${route.name} completed`,
                route: await Route.findById(routeId),
            };
        });
    }

    /**
     * Reactivate a completed route
     * @param {string} routeId - Route UUID
     * @param {string} adminId - Admin UUID
     * @returns {Promise<object>} Result
     */
    static async reactivate(routeId, adminId) {
        logger.info(`Reactivating route: ${routeId}`);

        const route = await Route.findById(routeId);
        if (!route) {
            throw new Error(`Route not found: ${routeId}`);
        }

        if (route.status === ROUTE_STATUS.ACTIVE) {
            return { success: true, message: 'Route is already active' };
        }

        await Route.updateStatus(routeId, ROUTE_STATUS.ACTIVE);

        // Log activity
        await RouteActivityLog.create({
            routeId,
            action: 'ROUTE_REACTIVATED',
            previousStatus: ROUTE_STATUS.COMPLETED,
            newStatus: ROUTE_STATUS.ACTIVE,
            isAdminForced: true,
            adminId,
        });

        // Emit socket event
        emitToAdmin(SOCKET_EVENTS.ROUTE_ASSIGNMENT_CHANGE, {
            action: 'reactivated',
            routeId,
            routeName: route.name,
        });

        logger.info(`Route ${route.name} reactivated`);

        return {
            success: true,
            message: `Route ${route.name} reactivated`,
            route: await Route.findById(routeId),
        };
    }

    /**
     * Get route activity history
     * @param {string} routeId - Route UUID
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} Activity logs
     */
    static async getActivityHistory(routeId, limit = 100) {
        return RouteActivityLog.findByRoute(routeId, limit);
    }

    /**
     * Get route assignment history
     * @param {string} routeId - Route UUID
     * @param {number} limit - Maximum number of records
     * @returns {Promise<Array>} Assignment history
     */
    static async getAssignmentHistory(routeId, limit = 50) {
        return RouteAssignment.getHistoryByRoute(routeId, limit);
    }
}

module.exports = RouteService;
