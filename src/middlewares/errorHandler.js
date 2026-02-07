const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
    // Log error
    logger.error(`Error: ${err.message}`, {
        stack: err.stack,
        path: req.path,
        method: req.method,
    });

    // Default error status and message
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = err.message;
    }

    if (err.code === '23505') {
        // PostgreSQL unique constraint violation
        statusCode = 409;
        message = 'Resource already exists';
    }

    if (err.code === '23503') {
        // PostgreSQL foreign key violation
        statusCode = 400;
        message = 'Referenced resource not found';
    }

    // Send response
    res.status(statusCode).json({
        success: false,
        message,
        ...(config.NODE_ENV === 'development' && {
            error: err.message,
            stack: err.stack,
        }),
    });
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
};

module.exports = {
    errorHandler,
    notFoundHandler,
};
