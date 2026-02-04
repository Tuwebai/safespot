import 'dotenv/config';
import pool from '../../src/config/database.js';

async function auditCommentTriggers() {
    const client = await pool.connect();
    try {
        console.log("--- TRIGGERS ON TABLE: comments ---");
        const commentsTriggers = await client.query(`
            SELECT tgname, pg_get_triggerdef(oid) as def
            FROM pg_trigger
            WHERE tgrelid = 'comments'::regclass
            AND NOT tgisinternal;
        `);
        console.table(commentsTriggers.rows);

        console.log("\n--- TRIGGERS ON TABLE: reports ---");
        const reportsTriggers = await client.query(`
            SELECT tgname, pg_get_triggerdef(oid) as def
            FROM pg_trigger
            WHERE tgrelid = 'reports'::regclass
            AND NOT tgisinternal;
        `);
        console.table(reportsTriggers.rows);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

auditCommentTriggers();
