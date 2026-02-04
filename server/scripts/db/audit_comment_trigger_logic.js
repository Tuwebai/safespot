import 'dotenv/config';
import pool from '../../src/config/database.js';

async function auditCommentTriggerLogic() {
    const client = await pool.connect();
    try {
        console.log("--- TRIGGER FUNCTION DEFINITION: update_report_comments_count ---");
        const funcRes = await client.query(`
            SELECT pg_get_functiondef('update_report_comments_count'::regproc);
        `);
        console.log(funcRes.rows[0]?.pg_get_functiondef || "FUNCTION NOT FOUND");

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

auditCommentTriggerLogic();
