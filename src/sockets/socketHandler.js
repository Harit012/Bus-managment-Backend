const { SOCKET_EVENTS } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Socket Handler - Manages Socket.IO events and connections
 */
class SocketHandler {
    static io = null;

    /**
     * Initialize socket handlers
     * @param {object} io - Socket.IO server instance
     */
    static initialize(io) {
        this.io = io;

        io.on('connection', (socket) => {
            this.handleConnection(socket);
        });

        logger.socket('Socket handlers initialized');
    }

    /**
     * Handle new client connection
     * @param {object} socket - Socket instance
     */
    static handleConnection(socket) {
        logger.socket(`New connection: ${socket.id}`);

        // Join admin room
        socket.on('join:admin', (data) => {
            socket.join('admin');
            logger.socket(`Socket ${socket.id} joined admin room`);

            // Send welcome message
            socket.emit('connected', {
                message: 'Connected to Bus Management System',
                socketId: socket.id,
                timestamp: new Date().toISOString(),
            });
        });

        // Leave admin room
        socket.on('leave:admin', () => {
            socket.leave('admin');
            logger.socket(`Socket ${socket.id} left admin room`);
        });

        // Subscribe to specific events
        socket.on('subscribe', (events) => {
            if (Array.isArray(events)) {
                events.forEach(event => {
                    socket.join(`event:${event}`);
                    logger.socket(`Socket ${socket.id} subscribed to ${event}`);
                });
            }
        });

        // Unsubscribe from events
        socket.on('unsubscribe', (events) => {
            if (Array.isArray(events)) {
                events.forEach(event => {
                    socket.leave(`event:${event}`);
                    logger.socket(`Socket ${socket.id} unsubscribed from ${event}`);
                });
            }
        });

        // Request dashboard refresh
        socket.on('request:dashboard', async () => {
            try {
                // Import services here to avoid circular dependency
                const { BusService, DriverService, RouteService } = require('../services');

                const [busStats, driverStats, routeStats, activeRoutes] = await Promise.all([
                    BusService.getStats(),
                    DriverService.getStats(),
                    RouteService.getStats(),
                    RouteService.getActiveWithAssignments(),
                ]);

                socket.emit(SOCKET_EVENTS.DASHBOARD_REFRESH, {
                    buses: busStats,
                    drivers: driverStats,
                    routes: routeStats,
                    activeRoutes,
                    timestamp: new Date().toISOString(),
                });

                logger.socket(`Dashboard data sent to ${socket.id}`);
            } catch (error) {
                logger.error('Error fetching dashboard data:', { error: error.message });
                socket.emit('error', { message: 'Failed to fetch dashboard data' });
            }
        });

        // Handle ping for connection health check
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: new Date().toISOString() });
        });

        // Handle disconnect
        socket.on('disconnect', (reason) => {
            logger.socket(`Socket ${socket.id} disconnected: ${reason}`);
        });

        // Handle errors
        socket.on('error', (error) => {
            logger.error(`Socket error for ${socket.id}:`, { error: error.message });
        });
    }

    /**
     * Emit event to admin room
     * @param {string} event - Event name
     * @param {object} data - Event data
     */
    static emitToAdmin(event, data) {
        if (this.io) {
            this.io.to('admin').emit(event, {
                ...data,
                timestamp: new Date().toISOString(),
            });
            logger.socket(`Emitted ${event} to admin room`);
        }
    }

    /**
     * Emit event to all connected clients
     * @param {string} event - Event name
     * @param {object} data - Event data
     */
    static broadcast(event, data) {
        if (this.io) {
            this.io.emit(event, {
                ...data,
                timestamp: new Date().toISOString(),
            });
            logger.socket(`Broadcast ${event} to all clients`);
        }
    }

    /**
     * Get connected clients count
     * @returns {number} Number of connected clients
     */
    static getConnectedCount() {
        if (this.io) {
            return this.io.engine.clientsCount;
        }
        return 0;
    }

    /**
     * Get admin room clients count
     * @returns {number} Number of clients in admin room
     */
    static async getAdminCount() {
        if (this.io) {
            const sockets = await this.io.in('admin').fetchSockets();
            return sockets.length;
        }
        return 0;
    }
}

module.exports = SocketHandler;
