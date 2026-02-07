const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');

const config = require('./config/env');
const { initializeSocket } = require('./config/socket');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares');
const Scheduler = require('./cron/scheduler');
const SocketHandler = require('./sockets/socketHandler');
const logger = require('./utils/logger');

// Create Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);
SocketHandler.initialize(io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
if (config.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// API Routes
app.use('/api', routes);

// Root route
app.get('/', (req, res) => {
    res.json({
        name: 'Bus Management System',
        version: '1.0.0',
        description: 'Backend API for managing bus fleet operations',
        endpoints: {
            health: '/api/health',
            admin: '/api/admin',
            buses: '/api/buses',
            drivers: '/api/drivers',
            routes: '/api/routes',
            activities: '/api/activities',
            history: '/api/history',
        },
        documentation: '/docs/flow.md',
    });
});

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.PORT;

server.listen(PORT, () => {
    logger.info(`🚌 Bus Management System started on port ${PORT}`);
    logger.info(`📡 Socket.IO ready for connections`);
    logger.info(`🌍 Environment: ${config.NODE_ENV}`);

    // Start cron scheduler
    Scheduler.start();
    logger.info(`⏰ Cron scheduler started (${config.CRON_SCHEDULE})`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    Scheduler.stop();
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    Scheduler.stop();
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', { reason, promise });
});

module.exports = { app, server };
