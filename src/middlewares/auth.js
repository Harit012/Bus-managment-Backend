const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { AdminUser } = require('../models');

/**
 * Authentication middleware for admin routes
 */
const authMiddleware = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.',
            });
        }

        // Check for Bearer token
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token format. Use Bearer token.',
            });
        }

        const token = authHeader.substring(7);

        // Verify token
        const decoded = jwt.verify(token, config.JWT.SECRET);

        // Get admin from database
        const admin = await AdminUser.findById(decoded.id);

        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token. Admin not found.',
            });
        }

        // Attach admin to request
        req.admin = admin;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token.',
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired.',
            });
        }

        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error.',
        });
    }
};

/**
 * Optional auth - attaches admin if token present, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = jwt.verify(token, config.JWT.SECRET);
            const admin = await AdminUser.findById(decoded.id);
            if (admin) {
                req.admin = admin;
            }
        }
        next();
    } catch (error) {
        // Ignore auth errors for optional auth
        next();
    }
};

module.exports = {
    authMiddleware,
    optionalAuth,
};
