import 'dotenv/config';
import pool from '../../src/config/database.js';

async function checkDefault() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT column_default 
            FROM information_schema.columns 
            WHERE table_name = 'reports' AND column_name = 'status';
        `);
        console.log("Current Default:", res.rows[0]?.column_default);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

checkDefault();
