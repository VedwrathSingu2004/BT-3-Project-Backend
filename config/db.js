import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    max: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 20,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS, 10) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS, 10) || 2000,
});

try {
    const client = await pool.connect();
    console.log(`Connected to PostgreSQL ${client.serverVersion} | Database: ${process.env.DB_DATABASE}`.stripColors.green);
    client.release();
} catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
}

pool.on('error', (err) => {
    console.error('Unexpected database error:', err.message);
});

export default {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect()
};