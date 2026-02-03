// server/check_global_stats.js
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkGlobalStats() {
    const client = await pool.connect();
    try {
        const res = await client.query("SELECT * FROM information_schema.columns WHERE table_name = 'global_stats'");
        console.log('📊 Global Stats Columns:');
        console.table(res.rows.map(r => ({ column: r.column_name, type: r.data_type })));
    } catch (e) {
        console.error('❌ Failed to check stats:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkGlobalStats();
