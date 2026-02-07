/**
 * Logger utility for consistent logging across the application
 */
const config = require('../config/env');

const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
};

const currentLevel = config.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

const formatMessage = (level, message, meta = {}) => {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
};

const logger = {
    error: (message, meta = {}) => {
        if (currentLevel >= LOG_LEVELS.ERROR) {
            console.error(formatMessage('ERROR', message, meta));
        }
    },

    warn: (message, meta = {}) => {
        if (currentLevel >= LOG_LEVELS.WARN) {
            console.warn(formatMessage('WARN', message, meta));
        }
    },

    info: (message, meta = {}) => {
        if (currentLevel >= LOG_LEVELS.INFO) {
            // console.log(formatMessage('INFO', message, meta));
        }
    },

    debug: (message, meta = {}) => {
        if (currentLevel >= LOG_LEVELS.DEBUG) {
            // console.log(formatMessage('DEBUG', message, meta));
        }
    },

    // Specialized loggers
    cron: (message, meta = {}) => {
        logger.info(`🕐 [CRON] ${message}`, meta);
    },

    socket: (message, meta = {}) => {
        logger.debug(`🔌 [SOCKET] ${message}`, meta);
    },

    db: (message, meta = {}) => {
        logger.debug(`📦 [DB] ${message}`, meta);
    },

    assignment: (message, meta = {}) => {
        logger.info(`🚌 [ASSIGNMENT] ${message}`, meta);
    },
};

module.exports = logger;
