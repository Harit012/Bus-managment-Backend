const db = require('../config/database');
const { Bus, Driver, Route, RouteAssignment } = require('../models');
const { BusActivityLog, DriverActivityLog, RouteActivityLog } = require('../models');
const { BUS_STATUS, DRIVER_STATUS, ACTIVITY_ACTIONS, SOCKET_EVENTS } = require('../utils/constants');
const { emitToAdmin } = require('../config/socket');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * Assignment Service - Core business logic for bus/driver/route assignments
 */
class AssignmentService {
    /**
     * Find an available driver that can work for the given route duration
     * @param {number} routeDuration - Route duration in minutes
     * @returns {Promise<object|null>} Available driver or null
     */
    static async findAvailableDriver(routeDuration) {
        logger.assignment(`Finding available driver for ${routeDuration} minute route`);

        const driver = await Driver.findFirstAvailable(routeDuration);

        if (driver) {
            logger.assignment(`Found available driver: ${driver.name} (${driver.employee_id})`);
        } else {
            logger.assignment('No available driver found');
        }

        return driver;
    }

    /**
     * Find an available bus that can do another round
     * @returns {Promise<object|null>} Available bus or null
     */
    static async findAvailableBus() {
        logger.assignment('Finding available bus');

        const buses = await Bus.findAvailable();
        const bus = buses[0] || null;

        if (bus) {
            logger.assignment(`Found available bus: ${bus.bus_number} (rounds today: ${bus.rounds_today})`);
        } else {
            logger.assignment('No available bus found');
        }

        return bus;
    }

    /**
     * Assign an available driver and bus to a route
     * @param {string} routeId - Route UUID
     * @returns {Promise<object>} Assignment result
     */
    static async assignDriverAndBusToRoute(routeId) {
        logger.assignment(`Auto-assigning driver and bus to route: ${routeId}`);

        return db.transaction(async (client) => {
            // Get route details
            const route = await Route.findById(routeId);
            if (!route) {
                throw new Error(`Route not found: ${routeId}`);
            }

            if (route.status !== 'ACTIVE') {
                throw new Error(`Route is not active: ${route.name}`);
            }

            // Check if route already has an active assignment
            const existingAssignment = await RouteAssignment.findActiveByRoute(routeId);
            if (existingAssignment) {
                logger.assignment(`Route ${route.name} already has an active assignment`);
                return { success: false, message: 'Route already has an assignment', assignment: existingAssignment };
            }

            // Find available driver
            const driver = await this.findAvailableDriver(route.duration_minutes);
            if (!driver) {
                return { success: false, message: 'No available driver found for this route duration' };
            }

            // Find available bus
            const bus = await this.findAvailableBus();
            if (!bus) {
                return { success: false, message: 'No available bus found' };
            }

            // Create assignment
            const assignment = await RouteAssignment.create({
                routeId,
                busId: bus.id,
                driverId: driver.id,
                isForced: false,
                roundNumber: bus.rounds_today + 1,
            });

            // Update bus status to RUNNING and increment rounds
            await Bus.updateStatus(bus.id, BUS_STATUS.RUNNING);
            await Bus.incrementRounds(bus.id);

            // Update driver status to RUNNING
            await Driver.updateStatus(driver.id, DRIVER_STATUS.RUNNING);

            // Log activities
            await BusActivityLog.create({
                busId: bus.id,
                action: ACTIVITY_ACTIONS.BUS_ASSIGNED_TO_ROUTE,
                previousStatus: BUS_STATUS.AVAILABLE,
                newStatus: BUS_STATUS.RUNNING,
                relatedRouteId: routeId,
                relatedDriverId: driver.id,
                isAdminForced: false,
            });

            await DriverActivityLog.create({
                driverId: driver.id,
                action: ACTIVITY_ACTIONS.DRIVER_ASSIGNED_TO_ROUTE,
                previousStatus: DRIVER_STATUS.AVAILABLE,
                newStatus: DRIVER_STATUS.RUNNING,
                relatedRouteId: routeId,
                relatedBusId: bus.id,
                isAdminForced: false,
            });

            await RouteActivityLog.create({
                routeId,
                action: ACTIVITY_ACTIONS.ROUTE_ASSIGNMENT_CREATED,
                relatedBusId: bus.id,
                relatedDriverId: driver.id,
                isAdminForced: false,
            });

            // Emit socket event
            emitToAdmin(SOCKET_EVENTS.ROUTE_ASSIGNMENT_CHANGE, {
                routeId,
                routeName: route.name,
                busId: bus.id,
                busNumber: bus.bus_number,
                driverId: driver.id,
                driverName: driver.name,
                action: 'created',
                isForced: false,
            });

            logger.assignment(`Assignment created: ${bus.bus_number} + ${driver.name} -> ${route.name}`);

            return {
                success: true,
                message: 'Assignment created successfully',
                assignment,
                bus,
                driver,
                route,
            };
        });
    }

    /**
     * Force assign a bus to a route (admin override)
     * @param {string} routeId - Route UUID
     * @param {string} busId - Bus UUID
     * @param {string} adminId - Admin UUID
     * @returns {Promise<object>} Assignment result
     */
    static async forceAssignBusToRoute(routeId, busId, adminId) {
        logger.assignment(`Force assigning bus ${busId} to route ${routeId} by admin ${adminId}`);

        return db.transaction(async (client) => {
            // Validate route
            const route = await Route.findById(routeId);
            if (!route) {
                throw new Error(`Route not found: ${routeId}`);
            }
            if (route.status !== 'ACTIVE') {
                throw new Error(`Route is not active: ${route.name}`);
            }

            // Validate bus
            const bus = await Bus.findById(busId);
            if (!bus) {
                throw new Error(`Bus not found: ${busId}`);
            }

            // Check bus constraints
            if (bus.status === BUS_STATUS.REST) {
                throw new Error(`Bus ${bus.bus_number} is at REST - cannot be force assigned`);
            }
            if (bus.status === BUS_STATUS.MAINTENANCE) {
                throw new Error(`Bus ${bus.bus_number} is under MAINTENANCE - cannot be force assigned`);
            }
            if (bus.rounds_today >= config.RULES.MAX_ROUNDS_PER_DAY) {
                throw new Error(`Bus ${bus.bus_number} has reached maximum rounds (${config.RULES.MAX_ROUNDS_PER_DAY}) for today`);
            }

            // Get existing assignment for route
            const existingAssignment = await RouteAssignment.findActiveByRoute(routeId);
            let previousBus = null;

            if (existingAssignment) {
                // If bus is already assigned to this route, nothing to do
                if (existingAssignment.bus_id === busId) {
                    return { success: true, message: 'Bus is already assigned to this route', assignment: existingAssignment };
                }

                // Get previous bus for replacement
                previousBus = await Bus.findById(existingAssignment.bus_id);

                // End bus assignment from previous bus
                if (previousBus) {
                    await Bus.updateStatus(previousBus.id, BUS_STATUS.AVAILABLE);

                    await BusActivityLog.create({
                        busId: previousBus.id,
                        action: ACTIVITY_ACTIONS.BUS_UNASSIGNED_FROM_ROUTE,
                        previousStatus: BUS_STATUS.RUNNING,
                        newStatus: BUS_STATUS.AVAILABLE,
                        relatedRouteId: routeId,
                        isAdminForced: true,
                        adminId,
                        details: { reason: 'Replaced by admin force assignment' },
                    });
                }

                // Update assignment with new bus
                await RouteAssignment.updateBus(existingAssignment.id, busId, true, adminId);
            } else {
                // No existing assignment - we need a driver too
                const driver = await this.findAvailableDriver(route.duration_minutes);
                if (!driver) {
                    throw new Error('No available driver found for force assignment');
                }

                // Create new assignment
                await RouteAssignment.create({
                    routeId,
                    busId,
                    driverId: driver.id,
                    isForced: true,
                    forcedByAdminId: adminId,
                    roundNumber: bus.rounds_today + 1,
                });

                // Update driver status
                await Driver.updateStatus(driver.id, DRIVER_STATUS.RUNNING);

                await DriverActivityLog.create({
                    driverId: driver.id,
                    action: ACTIVITY_ACTIONS.DRIVER_ASSIGNED_TO_ROUTE,
                    previousStatus: DRIVER_STATUS.AVAILABLE,
                    newStatus: DRIVER_STATUS.RUNNING,
                    relatedRouteId: routeId,
                    relatedBusId: busId,
                    isAdminForced: true,
                    adminId,
                });
            }

            // Update bus status
            const previousBusStatus = bus.status;
            if (bus.status !== BUS_STATUS.RUNNING) {
                await Bus.updateStatus(busId, BUS_STATUS.RUNNING);
                await Bus.incrementRounds(busId);
            }

            // Log bus activity
            await BusActivityLog.create({
                busId,
                action: ACTIVITY_ACTIONS.ADMIN_FORCE_ASSIGN_BUS,
                previousStatus: previousBusStatus,
                newStatus: BUS_STATUS.RUNNING,
                relatedRouteId: routeId,
                isAdminForced: true,
                adminId,
                details: { replacedBus: previousBus?.bus_number || null },
            });

            // Log route activity
            await RouteActivityLog.create({
                routeId,
                action: ACTIVITY_ACTIONS.ROUTE_ASSIGNMENT_UPDATED,
                relatedBusId: busId,
                isAdminForced: true,
                adminId,
                details: { previousBusId: previousBus?.id || null },
            });

            // Emit socket event
            emitToAdmin(SOCKET_EVENTS.ADMIN_FORCE_ASSIGNMENT, {
                type: 'bus',
                routeId,
                routeName: route.name,
                busId,
                busNumber: bus.bus_number,
                adminId,
                previousBus: previousBus?.bus_number || null,
            });

            logger.assignment(`Force assigned bus ${bus.bus_number} to route ${route.name}`);

            return {
                success: true,
                message: `Bus ${bus.bus_number} force assigned to route ${route.name}`,
                busId,
                routeId,
                replacedBusId: previousBus?.id || null,
            };
        });
    }

    /**
     * Force assign a driver to a route (admin override)
     * @param {string} routeId - Route UUID
     * @param {string} driverId - Driver UUID
     * @param {string} adminId - Admin UUID
     * @returns {Promise<object>} Assignment result
     */
    static async forceAssignDriverToRoute(routeId, driverId, adminId) {
        logger.assignment(`Force assigning driver ${driverId} to route ${routeId} by admin ${adminId}`);

        return db.transaction(async (client) => {
            // Validate route
            const route = await Route.findById(routeId);
            if (!route) {
                throw new Error(`Route not found: ${routeId}`);
            }
            if (route.status !== 'ACTIVE') {
                throw new Error(`Route is not active: ${route.name}`);
            }

            // Validate driver
            const driver = await Driver.findById(driverId);
            if (!driver) {
                throw new Error(`Driver not found: ${driverId}`);
            }

            // Check driver constraints
            if (driver.status === DRIVER_STATUS.OFF_DUTY) {
                throw new Error(`Driver ${driver.name} is OFF_DUTY - cannot be force assigned`);
            }

            const remainingMinutes = await Driver.getRemainingMinutes(driverId);
            if (remainingMinutes < route.duration_minutes) {
                throw new Error(
                    `Driver ${driver.name} has only ${remainingMinutes} minutes remaining, but route requires ${route.duration_minutes} minutes`
                );
            }

            // Get existing assignment for route
            const existingAssignment = await RouteAssignment.findActiveByRoute(routeId);
            let previousDriver = null;

            if (existingAssignment) {
                // If driver is already assigned to this route, nothing to do
                if (existingAssignment.driver_id === driverId) {
                    return { success: true, message: 'Driver is already assigned to this route', assignment: existingAssignment };
                }

                // Get previous driver for replacement
                previousDriver = await Driver.findById(existingAssignment.driver_id);

                // End driver assignment from previous driver
                if (previousDriver) {
                    await Driver.updateStatus(previousDriver.id, DRIVER_STATUS.AVAILABLE);

                    await DriverActivityLog.create({
                        driverId: previousDriver.id,
                        action: ACTIVITY_ACTIONS.DRIVER_UNASSIGNED_FROM_ROUTE,
                        previousStatus: DRIVER_STATUS.RUNNING,
                        newStatus: DRIVER_STATUS.AVAILABLE,
                        relatedRouteId: routeId,
                        isAdminForced: true,
                        adminId,
                        details: { reason: 'Replaced by admin force assignment' },
                    });
                }

                // Update assignment with new driver
                await RouteAssignment.updateDriver(existingAssignment.id, driverId, true, adminId);
            } else {
                // No existing assignment - we need a bus too
                const bus = await this.findAvailableBus();
                if (!bus) {
                    throw new Error('No available bus found for force assignment');
                }

                // Create new assignment
                await RouteAssignment.create({
                    routeId,
                    busId: bus.id,
                    driverId,
                    isForced: true,
                    forcedByAdminId: adminId,
                    roundNumber: bus.rounds_today + 1,
                });

                // Update bus status
                await Bus.updateStatus(bus.id, BUS_STATUS.RUNNING);
                await Bus.incrementRounds(bus.id);

                await BusActivityLog.create({
                    busId: bus.id,
                    action: ACTIVITY_ACTIONS.BUS_ASSIGNED_TO_ROUTE,
                    previousStatus: BUS_STATUS.AVAILABLE,
                    newStatus: BUS_STATUS.RUNNING,
                    relatedRouteId: routeId,
                    relatedDriverId: driverId,
                    isAdminForced: true,
                    adminId,
                });
            }

            // Update driver status
            const previousDriverStatus = driver.status;
            if (driver.status !== DRIVER_STATUS.RUNNING) {
                await Driver.updateStatus(driverId, DRIVER_STATUS.RUNNING);
            }

            // Log driver activity
            await DriverActivityLog.create({
                driverId,
                action: ACTIVITY_ACTIONS.ADMIN_FORCE_ASSIGN_DRIVER,
                previousStatus: previousDriverStatus,
                newStatus: DRIVER_STATUS.RUNNING,
                relatedRouteId: routeId,
                isAdminForced: true,
                adminId,
                details: { replacedDriver: previousDriver?.name || null },
            });

            // Log route activity
            await RouteActivityLog.create({
                routeId,
                action: ACTIVITY_ACTIONS.ROUTE_ASSIGNMENT_UPDATED,
                relatedDriverId: driverId,
                isAdminForced: true,
                adminId,
                details: { previousDriverId: previousDriver?.id || null },
            });

            // Emit socket event
            emitToAdmin(SOCKET_EVENTS.ADMIN_FORCE_ASSIGNMENT, {
                type: 'driver',
                routeId,
                routeName: route.name,
                driverId,
                driverName: driver.name,
                adminId,
                previousDriver: previousDriver?.name || null,
            });

            logger.assignment(`Force assigned driver ${driver.name} to route ${route.name}`);

            return {
                success: true,
                message: `Driver ${driver.name} force assigned to route ${route.name}`,
                driverId,
                routeId,
                replacedDriverId: previousDriver?.id || null,
            };
        });
    }

    /**
     * Unassign a driver from their current route
     * @param {string} driverId - Driver UUID
     * @param {string} newStatus - New driver status (default: AVAILABLE)
     * @returns {Promise<object>} Result
     */
    static async unassignDriver(driverId, newStatus = DRIVER_STATUS.AVAILABLE) {
        logger.assignment(`Unassigning driver: ${driverId}`);

        return db.transaction(async (client) => {
            const driver = await Driver.findById(driverId);
            if (!driver) {
                throw new Error(`Driver not found: ${driverId}`);
            }

            const assignment = await RouteAssignment.findActiveByDriver(driverId);
            if (!assignment) {
                return { success: true, message: 'Driver has no active assignment' };
            }

            // End assignment for driver
            await RouteAssignment.endByDriver(driverId);

            // Update driver status
            const previousStatus = driver.status;
            await Driver.updateStatus(driverId, newStatus);

            // Log activity
            await DriverActivityLog.create({
                driverId,
                action: ACTIVITY_ACTIONS.DRIVER_UNASSIGNED_FROM_ROUTE,
                previousStatus,
                newStatus,
                relatedRouteId: assignment.route_id,
                relatedBusId: assignment.bus_id,
                isAdminForced: false,
            });

            // Emit socket event
            emitToAdmin(SOCKET_EVENTS.DRIVER_STATUS_CHANGE, {
                driverId,
                driverName: driver.name,
                previousStatus,
                newStatus,
                action: 'unassigned',
            });

            logger.assignment(`Unassigned driver ${driver.name} from route`);

            return {
                success: true,
                message: `Driver ${driver.name} unassigned from route`,
                driverId,
                endedAssignment: assignment,
            };
        });
    }

    /**
     * Unassign a bus from its current route
     * @param {string} busId - Bus UUID
     * @param {string} newStatus - New bus status (default: AVAILABLE)
     * @returns {Promise<object>} Result
     */
    static async unassignBus(busId, newStatus = BUS_STATUS.AVAILABLE) {
        logger.assignment(`Unassigning bus: ${busId}`);

        return db.transaction(async (client) => {
            const bus = await Bus.findById(busId);
            if (!bus) {
                throw new Error(`Bus not found: ${busId}`);
            }

            const assignment = await RouteAssignment.findActiveByBus(busId);
            if (!assignment) {
                return { success: true, message: 'Bus has no active assignment' };
            }

            // End assignment for bus
            await RouteAssignment.endByBus(busId);

            // Update bus status
            const previousStatus = bus.status;
            await Bus.updateStatus(busId, newStatus);

            // Log activity
            await BusActivityLog.create({
                busId,
                action: ACTIVITY_ACTIONS.BUS_UNASSIGNED_FROM_ROUTE,
                previousStatus,
                newStatus,
                relatedRouteId: assignment.route_id,
                relatedDriverId: assignment.driver_id,
                isAdminForced: false,
            });

            // Emit socket event
            emitToAdmin(SOCKET_EVENTS.BUS_STATUS_CHANGE, {
                busId,
                busNumber: bus.bus_number,
                previousStatus,
                newStatus,
                action: 'unassigned',
            });

            logger.assignment(`Unassigned bus ${bus.bus_number} from route`);

            return {
                success: true,
                message: `Bus ${bus.bus_number} unassigned from route`,
                busId,
                endedAssignment: assignment,
            };
        });
    }

    /**
     * Complete a route round - updates driver work minutes and checks if bus should rest
     * @param {string} routeId - Route UUID
     * @returns {Promise<object>} Result
     */
    static async completeRouteRound(routeId) {
        logger.assignment(`Completing route round: ${routeId}`);

        return db.transaction(async (client) => {
            const route = await Route.findById(routeId);
            if (!route) {
                throw new Error(`Route not found: ${routeId}`);
            }

            const assignment = await RouteAssignment.findActiveByRoute(routeId);
            if (!assignment) {
                return { success: false, message: 'No active assignment for this route' };
            }

            const bus = await Bus.findById(assignment.bus_id);
            const driver = await Driver.findById(assignment.driver_id);

            if (!bus || !driver) {
                throw new Error('Invalid assignment - bus or driver not found');
            }

            // Add worked minutes to driver
            await Driver.addWorkedMinutes(driver.id, route.duration_minutes);
            const updatedDriver = await Driver.findById(driver.id);

            // Check if driver should go OFF_DUTY
            if (updatedDriver.worked_minutes_today >= config.RULES.MAX_DRIVER_MINUTES_PER_DAY) {
                await this.unassignDriver(driver.id, DRIVER_STATUS.OFF_DUTY);

                await DriverActivityLog.create({
                    driverId: driver.id,
                    action: ACTIVITY_ACTIONS.DRIVER_WENT_OFF_DUTY,
                    previousStatus: DRIVER_STATUS.RUNNING,
                    newStatus: DRIVER_STATUS.OFF_DUTY,
                    relatedRouteId: routeId,
                    relatedBusId: bus.id,
                    details: { workedMinutes: updatedDriver.worked_minutes_today },
                });

                logger.assignment(`Driver ${driver.name} went OFF_DUTY after ${updatedDriver.worked_minutes_today} minutes`);
            }

            // Check if bus should go to REST (3 rounds)
            if (bus.rounds_today >= config.RULES.MAX_ROUNDS_PER_DAY) {
                await this.unassignBus(bus.id, BUS_STATUS.REST);

                await BusActivityLog.create({
                    busId: bus.id,
                    action: ACTIVITY_ACTIONS.BUS_SENT_TO_REST,
                    previousStatus: BUS_STATUS.RUNNING,
                    newStatus: BUS_STATUS.REST,
                    relatedRouteId: routeId,
                    relatedDriverId: driver.id,
                    details: { roundsToday: bus.rounds_today },
                });

                logger.assignment(`Bus ${bus.bus_number} sent to REST after ${bus.rounds_today} rounds`);

                // Try to find a replacement bus
                const replacementBus = await this.findAvailableBus();
                if (replacementBus && driver.status !== DRIVER_STATUS.OFF_DUTY) {
                    await this.forceAssignBusToRoute(routeId, replacementBus.id, null);
                    logger.assignment(`Assigned replacement bus ${replacementBus.bus_number} to route ${route.name}`);
                }
            }

            return {
                success: true,
                message: 'Route round completed',
                routeId,
                driverWorkedMinutes: updatedDriver.worked_minutes_today,
                busRoundsToday: bus.rounds_today,
            };
        });
    }
}

module.exports = AssignmentService;
