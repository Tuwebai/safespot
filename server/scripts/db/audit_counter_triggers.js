import 'dotenv/config';
import pool from '../../src/config/database.js';

async function auditTriggerFunctions() {
    const client = await pool.connect();
    try {
        console.log("--- TRIGGER DEFINITIONS ---");
        const triggerRes = await client.query(`
            SELECT tgname, pg_get_triggerdef(oid) as def
            FROM pg_trigger 
            WHERE tgrelid = 'votes'::regclass
            AND NOT tgisinternal;
        `);
        console.table(triggerRes.rows);

        console.log("\n--- FUNCTION DEFINITION: update_vote_counters_v3 ---");
        const funcV3 = await client.query(`
            SELECT pg_get_functiondef('update_vote_counters_v3'::regproc);
        `);
        console.log(funcV3.rows[0]?.pg_get_functiondef || "FUNCTION v3 NOT FOUND");

        console.log("\n--- FUNCTION DEFINITION: update_vote_counters_v3_1 ---");
        const funcV3_1 = await client.query(`
            SELECT pg_get_functiondef('update_vote_counters_v3_1'::regproc);
        `);
        console.log(funcV3_1.rows[0]?.pg_get_functiondef || "FUNCTION v3_1 NOT FOUND");

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

auditTriggerFunctions();
