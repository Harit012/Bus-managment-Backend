const { Driver } = require('../models');
const { DriverService } = require('../services');
const { asyncHandler, successResponse } = require('../utils/helpers');
const config = require('../config/env');

/**
 * Driver Controller - Driver-related API endpoints
 */
class DriverController {
    /**
     * Get all drivers
     * GET /api/drivers
     */
    static getAll = asyncHandler(async (req, res) => {
        const drivers = await Driver.findAll();
        res.json(successResponse(drivers));
    });

    /**
     * Get driver by ID
     * GET /api/drivers/:id
     */
    static getById = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const driver = await Driver.findWithAssignment(id);

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: 'Driver not found',
            });
        }

        // Add remaining work time
        const remainingMinutes = config.RULES.MAX_DRIVER_MINUTES_PER_DAY - driver.worked_minutes_today;
        driver.remaining_minutes = Math.max(0, remainingMinutes);

        res.json(successResponse(driver));
    });

    /**
     * Get drivers by status
     * GET /api/drivers/status/:status
     */
    static getByStatus = asyncHandler(async (req, res) => {
        const { status } = req.params;
        const validStatuses = ['AVAILABLE', 'RUNNING', 'OFF_DUTY'];

        if (!validStatuses.includes(status.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Valid values: ${validStatuses.join(', ')}`,
            });
        }

        const drivers = await Driver.findByStatus(status.toUpperCase());
        res.json(successResponse(drivers));
    });

    /**
     * Get available drivers for a route duration
     * GET /api/drivers/available?duration=60
     */
    static getAvailable = asyncHandler(async (req, res) => {
        const duration = parseInt(req.query.duration, 10) || 60;
        const drivers = await Driver.findAvailableForDuration(duration);
        res.json(successResponse(drivers));
    });

    /**
     * Create a new driver
     * POST /api/drivers
     */
    static create = asyncHandler(async (req, res) => {
        const { name, employeeId, licenseNumber, phone, status } = req.body;

        if (!name || !employeeId) {
            return res.status(400).json({
                success: false,
                message: 'Name and employee ID are required',
            });
        }

        const driver = await Driver.create({ name, employeeId, licenseNumber, phone, status });
        res.status(201).json(successResponse(driver, 'Driver created successfully'));
    });

    /**
     * Get driver statistics
     * GET /api/drivers/stats
     */
    static getStats = asyncHandler(async (req, res) => {
        const stats = await DriverService.getStats();
        res.json(successResponse(stats));
    });

    /**
     * Get driver activity history
     * GET /api/drivers/:id/history
     */
    static getHistory = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const limit = parseInt(req.query.limit, 10) || 100;

        const driver = await Driver.findById(id);
        if (!driver) {
            return res.status(404).json({
                success: false,
                message: 'Driver not found',
            });
        }

        const history = await DriverService.getActivityHistory(id, limit);
        res.json(successResponse({
            driver,
            history,
        }));
    });

    /**
     * Get driver assignment history
     * GET /api/drivers/:id/assignments
     */
    static getAssignments = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const limit = parseInt(req.query.limit, 10) || 50;

        const driver = await Driver.findById(id);
        if (!driver) {
            return res.status(404).json({
                success: false,
                message: 'Driver not found',
            });
        }

        const assignments = await DriverService.getAssignmentHistory(id, limit);
        res.json(successResponse({
            driver,
            assignments,
        }));
    });
}

module.exports = DriverController;
