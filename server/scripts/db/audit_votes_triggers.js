import 'dotenv/config';
import pool from '../../src/config/database.js';

async function auditTriggers() {
    const client = await pool.connect();
    try {
        console.log("--- TRIGGER FUNCTION DEFINITION: update_trust_activity_counters ---");
        const funcRes = await client.query(`
            SELECT pg_get_functiondef('update_trust_activity_counters'::regproc);
        `);
        console.log(funcRes.rows[0]?.pg_get_functiondef || "FUNCTION NOT FOUND");

        console.log("\n--- TRIGGERS ON TABLE: votes ---");
        const triggerRes = await client.query(`
            SELECT tgname, pg_get_triggerdef(oid) as def
            FROM pg_trigger 
            WHERE tgrelid = 'votes'::regclass;
        `);
        console.table(triggerRes.rows);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

auditTriggers();
