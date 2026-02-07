const { Server } = require('socket.io');

let io = null;

/**
 * Initialize Socket.IO server
 * @param {object} server - HTTP server instance
 * @returns {object} Socket.IO server instance
 */
const initializeSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });

    io.on('connection', (socket) => {
        // console.log(`🔌 Client connected: ${socket.id}`);

        // Join admin room for dashboard updates
        socket.on('join:admin', () => {
            socket.join('admin');
            // console.log("{ username, password }", { username, password })`);
        });

        socket.on('disconnect', () => {
            // console.log(`🔌 Client disconnected: ${socket.id}`);
        });
    });

    // console.log('🚀 Socket.IO initialized');
    return io;
};

/**
 * Get Socket.IO instance
 * @returns {object} Socket.IO server instance
 */
const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized');
    }
    return io;
};

/**
 * Emit event to admin room
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
const emitToAdmin = (event, data) => {
    if (io) {
        io.to('admin').emit(event, {
            ...data,
            timestamp: new Date().toISOString(),
        });
    }
};

module.exports = {
    initializeSocket,
    getIO,
    emitToAdmin,
};
