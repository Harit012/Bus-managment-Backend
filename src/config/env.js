// Environment configuration
require('dotenv').config();

module.exports = {
  // Server configuration
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database configuration
  DB: {
    HOST: process.env.DB_HOST || 'localhost',
    PORT: process.env.DB_PORT || 5432,
    NAME: process.env.DB_NAME || 'bus_management',
    USER: process.env.DB_USER || 'postgres',
    PASSWORD: process.env.DB_PASSWORD || 'postgres',
  },

  // JWT configuration
  JWT: {
    SECRET: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
    EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  },

  // Business rules
  RULES: {
    MAX_BUSES: 50,
    MAX_ROUTES: 10,
    MAX_ROUNDS_PER_DAY: 3,
    MAX_DRIVER_MINUTES_PER_DAY: 480, // 8 hours
  },

  // Cron schedule (every 2 minutes)
  CRON_SCHEDULE: '*/2 * * * *',
  CRON_INTERVAL_MINUTES: 2,
};
