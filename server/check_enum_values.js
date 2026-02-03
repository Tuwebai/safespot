// server/check_enum_values.js
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkEnum() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT unnest(enum_range(NULL::moderation_action_type)) as value
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

checkEnum();
