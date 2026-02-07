/**
 * Request validation middleware
 */

/**
 * Validate UUID format
 * @param {string} paramName - Name of the parameter to validate
 */
const validateUUID = (paramName) => (req, res, next) => {
    const value = req.params[paramName] || req.body[paramName];

    if (!value) {
        return res.status(400).json({
            success: false,
            message: `${paramName} is required`,
        });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(value)) {
        return res.status(400).json({
            success: false,
            message: `Invalid UUID format for ${paramName}`,
        });
    }

    next();
};

/**
 * Validate required fields in request body
 * @param {Array<string>} fields - List of required field names
 */
const validateRequired = (fields) => (req, res, next) => {
    const missing = fields.filter(field => !req.body[field]);

    if (missing.length > 0) {
        return res.status(400).json({
            success: false,
            message: `Missing required fields: ${missing.join(', ')}`,
        });
    }

    next();
};

/**
 * Validate route data
 */
const validateRouteData = (req, res, next) => {
    const { name, durationMinutes } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Route name is required',
        });
    }

    if (!durationMinutes || typeof durationMinutes !== 'number' || durationMinutes <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Duration must be a positive number',
        });
    }

    if (durationMinutes > 480) {
        return res.status(400).json({
            success: false,
            message: 'Duration cannot exceed 480 minutes (8 hours)',
        });
    }

    next();
};

/**
 * Validate bus data
 */
const validateBusData = (req, res, next) => {
    const { busNumber } = req.body;

    if (!busNumber || typeof busNumber !== 'string' || busNumber.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Bus number is required',
        });
    }

    next();
};

/**
 * Validate driver data
 */
const validateDriverData = (req, res, next) => {
    const { name, employeeId } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Driver name is required',
        });
    }

    if (!employeeId || typeof employeeId !== 'string' || employeeId.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Employee ID is required',
        });
    }

    next();
};

module.exports = {
    validateUUID,
    validateRequired,
    validateRouteData,
    validateBusData,
    validateDriverData,
};
