import 'dotenv/config';
import pool from '../../src/config/database.js';

async function verifyTriggers() {
    const client = await pool.connect();
    try {
        console.log("--- FINAL VOTE TRIGGERS ---");
        const res = await client.query(`
            SELECT tgname 
            FROM pg_trigger 
            WHERE tgrelid = 'votes'::regclass 
            AND NOT tgisinternal
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

verifyTriggers();
