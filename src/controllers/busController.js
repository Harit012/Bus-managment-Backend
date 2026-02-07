const { Bus } = require('../models');
const { BusService } = require('../services');
const { asyncHandler, successResponse } = require('../utils/helpers');

/**
 * Bus Controller - Bus-related API endpoints
 */
class BusController {
    /**
     * Get all buses
     * GET /api/buses
     */
    static getAll = asyncHandler(async (req, res) => {
        const buses = await Bus.findAll();
        res.json(successResponse(buses));
    });

    /**
     * Get bus by ID
     * GET /api/buses/:id
     */
    static getById = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const bus = await Bus.findWithAssignment(id);

        if (!bus) {
            return res.status(404).json({
                success: false,
                message: 'Bus not found',
            });
        }

        res.json(successResponse(bus));
    });

    /**
     * Get buses by status
     * GET /api/buses/status/:status
     */
    static getByStatus = asyncHandler(async (req, res) => {
        const { status } = req.params;
        const validStatuses = ['AVAILABLE', 'RUNNING', 'REST', 'MAINTENANCE'];

        if (!validStatuses.includes(status.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Valid values: ${validStatuses.join(', ')}`,
            });
        }

        const buses = await Bus.findByStatus(status.toUpperCase());
        res.json(successResponse(buses));
    });

    /**
     * Get available buses
     * GET /api/buses/available
     */
    static getAvailable = asyncHandler(async (req, res) => {
        const buses = await Bus.findAvailable();
        res.json(successResponse(buses));
    });

    /**
     * Create a new bus
     * POST /api/buses
     */
    static create = asyncHandler(async (req, res) => {
        const { busNumber, status } = req.body;

        if (!busNumber) {
            return res.status(400).json({
                success: false,
                message: 'Bus number is required',
            });
        }

        const bus = await Bus.create({ busNumber, status });
        res.status(201).json(successResponse(bus, 'Bus created successfully'));
    });

    /**
     * Get bus statistics
     * GET /api/buses/stats
     */
    static getStats = asyncHandler(async (req, res) => {
        const stats = await BusService.getStats();
        res.json(successResponse(stats));
    });

    /**
     * Get bus activity history
     * GET /api/buses/:id/history
     */
    static getHistory = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const limit = parseInt(req.query.limit, 10) || 100;

        const bus = await Bus.findById(id);
        if (!bus) {
            return res.status(404).json({
                success: false,
                message: 'Bus not found',
            });
        }

        const history = await BusService.getActivityHistory(id, limit);
        res.json(successResponse({
            bus,
            history,
        }));
    });

    /**
     * Get bus assignment history
     * GET /api/buses/:id/assignments
     */
    static getAssignments = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const limit = parseInt(req.query.limit, 10) || 50;

        const bus = await Bus.findById(id);
        if (!bus) {
            return res.status(404).json({
                success: false,
                message: 'Bus not found',
            });
        }

        const assignments = await BusService.getAssignmentHistory(id, limit);
        res.json(successResponse({
            bus,
            assignments,
        }));
    });
}

module.exports = BusController;
