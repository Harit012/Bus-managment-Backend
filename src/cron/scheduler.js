const cron = require('node-cron');
const config = require('../config/env');
const { BUS_STATUS, DRIVER_STATUS, SOCKET_EVENTS } = require('../utils/constants');
const { emitToAdmin } = require('../config/socket');
const logger = require('../utils/logger');

/**
 * Cron Scheduler - Runs every 5 minutes to manage route assignments
 */
class Scheduler {
    static cronJob = null;
    static isFirstRun = true;

    /**
     * Start the cron scheduler
     */
    static start() {
        logger.cron(`Starting scheduler with schedule: ${config.CRON_SCHEDULE}`);

        this.cronJob = cron.schedule(config.CRON_SCHEDULE, async () => {
            logger.cron('=== CRON JOB STARTED ===');

            try {
                await this.runAssignmentCheck();
                logger.cron('=== CRON JOB COMPLETED ===');
            } catch (error) {
                logger.error('Cron job failed:', { error: error.message });
            }
        });

        logger.cron('Scheduler started successfully');
    }

    /**
     * Stop the cron scheduler
     */
    static stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            logger.cron('Scheduler stopped');
        }
    }

    /**
     * Main assignment check logic
     * Runs every 5 minutes to ensure all active routes have valid assignments
     */
    static async runAssignmentCheck() {
        const startTime = Date.now();
        const actions = [];

        try {
            const Route = require('../models/Route');
            const RouteAssignment = require('../models/RouteAssignment');
            const AssignmentService = require('../services/assignmentService');

            // Step 1: Reset daily counters if needed
            await this.resetDailyCounters();

            // Step 2: Update worked minutes for running drivers (skip on first run)
            if (!this.isFirstRun) {
                await this.updateRunningDriversWorkedTime();
            } else {
                this.isFirstRun = false;
                logger.cron('Skipping driver time update on first run (drivers just assigned)');
            }

            // Step 3: Reactivate COMPLETED routes
            await this.reactivateCompletedRoutes();

            // Step 4: Get all active routes
            const activeRoutes = await Route.findActive();
            logger.cron(`Found ${activeRoutes.length} active routes`);

            // Step 5: Process each active route
            for (const route of activeRoutes) {
                const result = await this.processRoute(route);
                if (result.action) {
                    actions.push(result);
                }
            }

            // Step 6: Check for invalid assignments (bus/driver status changed)
            await this.checkInvalidAssignments();

            const duration = Date.now() - startTime;
            logger.cron(`Cron job completed in ${duration}ms, ${actions.length} actions taken`);

            // Emit cron execution event to admin dashboard
            emitToAdmin(SOCKET_EVENTS.CRON_EXECUTED, {
                duration,
                actionsCount: actions.length,
                actions: actions.map(a => ({
                    routeId: a.routeId,
                    routeName: a.routeName,
                    action: a.action,
                })),
            });

            // Emit dashboard refresh
            emitToAdmin(SOCKET_EVENTS.DASHBOARD_REFRESH, {
                reason: 'cron_job',
                actionsCount: actions.length,
            });

            return { success: true, actionsCount: actions.length, duration };
        } catch (error) {
            logger.error('Assignment check failed:', { error: error.message });
            throw error;
        }
    }

    /**
     * Update worked minutes for all drivers currently running routes
     * Adds 5 minutes (cron interval) to their worked_minutes_today
     */
    static async updateRunningDriversWorkedTime() {
        const Driver = require('../models/Driver');
        const CRON_INTERVAL_MINUTES = config.CRON_INTERVAL_MINUTES;

        // Find all running drivers
        const runningDrivers = await Driver.findByStatus(DRIVER_STATUS.RUNNING);

        if (runningDrivers.length === 0) {
            return;
        }

        logger.cron(`Updating worked time for ${runningDrivers.length} running drivers (+${CRON_INTERVAL_MINUTES} min each)`);

        for (const driver of runningDrivers) {
            const updatedDriver = await Driver.addWorkedMinutes(driver.id, CRON_INTERVAL_MINUTES);

            // Check if driver has now exceeded max hours
            if (updatedDriver.worked_minutes_today >= config.RULES.MAX_DRIVER_MINUTES_PER_DAY) {
                logger.cron(`Driver ${driver.name} reached max hours (${updatedDriver.worked_minutes_today} min), setting OFF_DUTY`);
                await Driver.updateStatus(driver.id, DRIVER_STATUS.OFF_DUTY);
            }
        }

        // Emit driver update event so frontend refreshes in real-time
        emitToAdmin(SOCKET_EVENTS.DRIVER_STATUS_CHANGE, {
            action: 'worked_time_updated',
            driversUpdated: runningDrivers.length,
            reason: 'cron_update',
        });
    }

    /**
     * Reactivate all COMPLETED routes
     * This puts completed routes back into the pool for auto-assignment
     */
    static async reactivateCompletedRoutes() {
        const Route = require('../models/Route');
        const { RouteActivityLog } = require('../models/ActivityLog');
        // Find all completed routes
        const completedRoutes = await Route.findByStatus('COMPLETED');

        if (completedRoutes.length === 0) {
            return;
        }

        logger.cron(`Reactivating ${completedRoutes.length} completed routes`);

        for (const route of completedRoutes) {
            // Update status to ACTIVE
            await Route.updateStatus(route.id, 'ACTIVE');

            // Log activity (system-driven)
            const { RouteActivityLog } = require('../models');
            await RouteActivityLog.create({
                routeId: route.id,
                action: 'ROUTE_REACTIVATED',
                newStatus: 'ACTIVE',
                details: { reason: 'Systematic reactivation via cron' },
            });

            // Emit socket event
            emitToAdmin(SOCKET_EVENTS.ROUTE_ASSIGNMENT_CHANGE, {
                action: 'reactivated',
                routeId: route.id,
                routeName: route.name,
                isSystemic: true,
            });
        }
    }

    /**
     * Reset daily counters for buses and drivers
     */
    static async resetDailyCounters() {
        const Bus = require('../models/Bus');
        const Driver = require('../models/Driver');
        const busesReset = await Bus.resetDailyCounters();
        const driversReset = await Driver.resetDailyCounters();

        if (busesReset > 0 || driversReset > 0) {
            logger.cron(`Reset daily counters: ${busesReset} buses, ${driversReset} drivers`);
        }
    }

    /**
     * Process a single route - ensure it has a valid assignment and auto-complete if duration elapsed
     */
    static async processRoute(route) {
        const Bus = require('../models/Bus');
        const Driver = require('../models/Driver');
        const RouteAssignment = require('../models/RouteAssignment');
        const AssignmentService = require('../services/assignmentService');
        const result = { routeId: route.id, routeName: route.name, action: null };

        // Get current assignment
        const assignment = await RouteAssignment.findActiveByRoute(route.id);

        if (!assignment) {
            // No assignment - try to create one
            logger.cron(`Route ${route.name} has no assignment, attempting auto-assign`);

            const assignResult = await AssignmentService.assignDriverAndBusToRoute(route.id);

            if (assignResult.success) {
                result.action = 'created_new_assignment';
                logger.cron(`Created new assignment for ${route.name}`);
            } else {
                result.action = 'no_resources_available';
                logger.cron(`Could not assign to ${route.name}: ${assignResult.message}`);
            }

            return result;
        }

        // Check if route duration has elapsed - auto-complete the round
        const elapsedMs = Date.now() - new Date(assignment.started_at).getTime();
        const elapsedMinutes = elapsedMs / (1000 * 60);

        if (elapsedMinutes >= route.duration_minutes) {
            logger.cron(`Route ${route.name} duration (${route.duration_minutes} min) elapsed (${Math.round(elapsedMinutes)} min), auto-completing round`);

            try {
                const bus = assignment.bus_id ? await Bus.findById(assignment.bus_id) : null;
                const driver = assignment.driver_id ? await Driver.findById(assignment.driver_id) : null;

                // End the current assignment
                await RouteAssignment.end(assignment.id);

                // Add route duration to driver worked time
                if (driver) {
                    await Driver.addWorkedMinutes(driver.id, route.duration_minutes);
                    const updatedDriver = await Driver.findById(driver.id);

                    if (updatedDriver.worked_minutes_today >= config.RULES.MAX_DRIVER_MINUTES_PER_DAY) {
                        await Driver.updateStatus(driver.id, DRIVER_STATUS.OFF_DUTY);
                        logger.cron(`Driver ${driver.name} went OFF_DUTY (${updatedDriver.worked_minutes_today} min)`);
                    } else {
                        await Driver.updateStatus(driver.id, DRIVER_STATUS.AVAILABLE);
                    }
                }

                // Check if bus should go to REST (based on rounds_today which was incremented when assigned)
                if (bus) {
                    if (bus.rounds_today >= config.RULES.MAX_ROUNDS_PER_DAY) {
                        await Bus.updateStatus(bus.id, BUS_STATUS.REST);
                        logger.cron(`Bus ${bus.bus_number} sent to REST (${bus.rounds_today} rounds)`);
                    } else {
                        await Bus.updateStatus(bus.id, BUS_STATUS.AVAILABLE);
                    }
                }

                // Emit socket events for live updates
                emitToAdmin(SOCKET_EVENTS.ROUTE_ASSIGNMENT_CHANGE, {
                    action: 'round_completed',
                    routeId: route.id,
                    routeName: route.name,
                    busRounds: bus ? bus.rounds_today : 0,
                    driverWorked: driver ? driver.worked_minutes_today : 0,
                });

                emitToAdmin(SOCKET_EVENTS.BUS_STATUS_CHANGE, {
                    action: 'round_completed',
                    routeId: route.id,
                    routeName: route.name,
                    reason: 'auto_complete',
                });

                emitToAdmin(SOCKET_EVENTS.DRIVER_STATUS_CHANGE, {
                    action: 'round_completed',
                    routeId: route.id,
                    routeName: route.name,
                    reason: 'auto_complete',
                });

                // Re-assign a new bus and driver for the next round
                const reassignResult = await AssignmentService.assignDriverAndBusToRoute(route.id);
                if (reassignResult.success) {
                    logger.cron(`Re-assigned new round for ${route.name}`);
                } else {
                    logger.cron(`Could not re-assign ${route.name}: ${reassignResult.message}`);
                }

                result.action = 'auto_completed_round';
                return result;
            } catch (error) {
                logger.error(`Failed to auto-complete route ${route.name}:`, { error: error.message });
                result.action = 'auto_complete_failed';
                return result;
            }
        }

        // Check if assignment is still valid
        const bus = assignment.bus_id ? await Bus.findById(assignment.bus_id) : null;
        const driver = assignment.driver_id ? await Driver.findById(assignment.driver_id) : null;

        // Check bus status
        if (bus && (bus.status === BUS_STATUS.MAINTENANCE || bus.status === BUS_STATUS.REST)) {
            // Skip if this was an admin-forced assignment and bus just went to rest/maintenance
            if (assignment.is_forced) {
                logger.cron(`Skipping forced assignment on ${route.name} (admin override)`);
                // But if bus is invalid, we still need to replace it
                if (bus.status !== BUS_STATUS.RUNNING) {
                    logger.cron(`But bus ${bus.bus_number} is ${bus.status}, finding replacement`);
                    await this.replaceInvalidBus(route, assignment, driver);
                    result.action = 'replaced_invalid_bus';
                }
            } else {
                logger.cron(`Bus ${bus.bus_number} on ${route.name} is ${bus.status}, finding replacement`);
                await this.replaceInvalidBus(route, assignment, driver);
                result.action = 'replaced_invalid_bus';
            }
        }

        // Check driver status
        if (driver && driver.status === DRIVER_STATUS.OFF_DUTY) {
            logger.cron(`Driver ${driver.name} on ${route.name} is OFF_DUTY, finding replacement`);
            await this.replaceInvalidDriver(route, assignment, bus);
            result.action = result.action ? `${result.action}_and_driver` : 'replaced_invalid_driver';
        }

        return result;
    }

    /**
     * Replace an invalid bus on a route
     */
    static async replaceInvalidBus(route, assignment, currentDriver) {
        const Bus = require('../models/Bus');
        const RouteAssignment = require('../models/RouteAssignment');
        const AssignmentService = require('../services/assignmentService');
        // Find a new available bus
        const newBus = await AssignmentService.findAvailableBus();

        if (!newBus) {
            logger.cron(`No available bus to replace on ${route.name}`);
            return false;
        }

        // Unassign the old bus
        if (assignment.bus_id) {
            await AssignmentService.unassignBus(assignment.bus_id);
        }

        // If we have a valid driver, update the assignment; otherwise create new
        if (currentDriver && currentDriver.status === DRIVER_STATUS.RUNNING) {
            await RouteAssignment.updateBus(assignment.id, newBus.id, false, null);
            await Bus.updateStatus(newBus.id, BUS_STATUS.RUNNING);
            await Bus.incrementRounds(newBus.id);
        } else {
            // Need a full new assignment
            await RouteAssignment.end(assignment.id);
            await AssignmentService.assignDriverAndBusToRoute(route.id);
        }

        logger.cron(`Replaced bus on ${route.name} with ${newBus.bus_number}`);
        return true;
    }

    /**
     * Replace an invalid driver on a route
     */
    static async replaceInvalidDriver(route, assignment, currentBus) {
        const Driver = require('../models/Driver');
        const RouteAssignment = require('../models/RouteAssignment');
        const AssignmentService = require('../services/assignmentService');
        // Find a new available driver
        const newDriver = await AssignmentService.findAvailableDriver(route.duration_minutes);

        if (!newDriver) {
            logger.cron(`No available driver to replace on ${route.name}`);
            return false;
        }

        // Unassign the old driver
        if (assignment.driver_id) {
            await AssignmentService.unassignDriver(assignment.driver_id);
        }

        // If we have a valid bus, update the assignment; otherwise create new
        if (currentBus && currentBus.status === BUS_STATUS.RUNNING) {
            await RouteAssignment.updateDriver(assignment.id, newDriver.id, false, null);
            await Driver.updateStatus(newDriver.id, DRIVER_STATUS.RUNNING);
        } else {
            // Need a full new assignment
            await RouteAssignment.end(assignment.id);
            await AssignmentService.assignDriverAndBusToRoute(route.id);
        }

        logger.cron(`Replaced driver on ${route.name} with ${newDriver.name}`);
        return true;
    }

    /**
     * Check for any invalid assignments and clean them up
     */
    static async checkInvalidAssignments() {
        const RouteAssignment = require('../models/RouteAssignment');
        const activeAssignments = await RouteAssignment.findAllActive();

        for (const assignment of activeAssignments) {
            // Check if bus is still valid for running
            if (assignment.bus_id && assignment.bus_status !== BUS_STATUS.RUNNING) {
                // Bus status changed - this shouldn't happen but clean up if it does
                logger.cron(`Found invalid bus status in assignment: ${assignment.id}`);
            }

            // Check if driver is still valid for running
            if (assignment.driver_id && assignment.driver_status !== DRIVER_STATUS.RUNNING) {
                logger.cron(`Found invalid driver status in assignment: ${assignment.id}`);
            }
        }
    }

    /**
     * Manually trigger a cron run (for testing or admin override)
     */
    static async triggerManualRun() {
        logger.cron('Manual cron run triggered');
        return this.runAssignmentCheck();
    }
}

module.exports = Scheduler;
