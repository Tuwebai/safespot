import 'dotenv/config';
import pool from '../../src/config/database.js';

async function getTriggerDef() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT pg_get_triggerdef(oid) as def
            FROM pg_trigger
            WHERE tgname = 'trg_report_state_machine';
        `);
        console.log(res.rows[0]?.def);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

getTriggerDef();
