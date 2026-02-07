const { Pool } = require('pg');
const config = require('./env');

// Create PostgreSQL connection pool
const pool = new Pool({
    host: config.DB.HOST,
    port: config.DB.PORT,
    database: config.DB.NAME,
    user: config.DB.USER,
    password: config.DB.PASSWORD,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
    console.log('📦 Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL pool error:', err);
    process.exit(-1);
});

/**
 * Execute a query with parameters
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<object>} Query result
 */
const query = async (text, params) => {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (config.NODE_ENV === 'development') {
        console.log('📝 Query executed:', { text: text.substring(0, 100), duration: `${duration}ms`, rows: result.rowCount });
    }

    return result;
};

/**
 * Get a client from the pool for transactions
 * @returns {Promise<object>} Pool client
 */
const getClient = async () => {
    const client = await pool.connect();
    const originalQuery = client.query.bind(client);
    const originalRelease = client.release.bind(client);

    // Monkey-patch release to log timeout
    const timeout = setTimeout(() => {
        console.error('⚠️ Client has been checked out for more than 5 seconds!');
    }, 5000);

    client.release = () => {
        clearTimeout(timeout);
        return originalRelease();
    };

    client.query = (...args) => {
        return originalQuery(...args);
    };

    return client;
};

/**
 * Execute a transaction
 * @param {Function} callback - Async function that receives the client
 * @returns {Promise<any>} Transaction result
 */
const transaction = async (callback) => {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    pool,
    query,
    getClient,
    transaction,
};
