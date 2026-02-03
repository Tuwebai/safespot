// server/dump_function.js
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function dumpFunction() {
    const client = await pool.connect();
    try {
        const res = await client.query("SELECT pg_get_functiondef('sync_global_stats_reports'::regproc)");
        console.log('📜 Function Definition:');
        console.log(res.rows[0].pg_get_functiondef);
    } catch (e) {
        console.error('❌ Failed to dump function:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

dumpFunction();
