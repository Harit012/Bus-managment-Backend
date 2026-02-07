const config = require('../config/env');

/**
 * Helper utility functions
 */

/**
 * Calculate remaining work minutes for a driver today
 * @param {number} workedMinutes - Minutes already worked today
 * @returns {number} Remaining minutes available
 */
const getRemainingDriverMinutes = (workedMinutes) => {
    return Math.max(0, config.RULES.MAX_DRIVER_MINUTES_PER_DAY - workedMinutes);
};

/**
 * Check if driver can work for given duration
 * @param {number} workedMinutes - Minutes already worked today
 * @param {number} routeDuration - Route duration in minutes
 * @returns {boolean} True if driver can work the route
 */
const canDriverWorkRoute = (workedMinutes, routeDuration) => {
    return getRemainingDriverMinutes(workedMinutes) >= routeDuration;
};

/**
 * Check if bus can do another round
 * @param {number} roundsToday - Number of rounds completed today
 * @returns {boolean} True if bus can do another round
 */
const canBusDoAnotherRound = (roundsToday) => {
    return roundsToday < config.RULES.MAX_ROUNDS_PER_DAY;
};

/**
 * Format duration in minutes to human readable string
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration
 */
const formatDuration = (minutes) => {
    if (minutes < 60) {
        return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

/**
 * Get start of current day (midnight)
 * @returns {Date} Start of today
 */
const getStartOfDay = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/**
 * Check if date is today
 * @param {Date} date - Date to check
 * @returns {boolean} True if date is today
 */
const isToday = (date) => {
    const today = getStartOfDay();
    const checkDate = new Date(date);
    return checkDate >= today;
};

/**
 * Generate a unique identifier
 * @returns {string} UUID v4
 */
const generateId = () => {
    const { v4: uuidv4 } = require('uuid');
    return uuidv4();
};

/**
 * Async wrapper for handling errors in async route handlers
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Create success response object
 * @param {any} data - Response data
 * @param {string} message - Success message
 * @returns {object} Response object
 */
const successResponse = (data, message = 'Success') => {
    return {
        success: true,
        message,
        data,
        timestamp: new Date().toISOString(),
    };
};

/**
 * Create error response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @returns {object} Error object
 */
const errorResponse = (message, statusCode = 500) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

module.exports = {
    getRemainingDriverMinutes,
    canDriverWorkRoute,
    canBusDoAnotherRound,
    formatDuration,
    getStartOfDay,
    isToday,
    generateId,
    asyncHandler,
    successResponse,
    errorResponse,
};
