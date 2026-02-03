
import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function dump() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT proname, pg_get_functiondef(p.oid) as def
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE p.proname IN ('trigger_recalculate_trust_score', 'enforce_auto_moderation')
        `);

        let sql = `-- ROLLBACK SCRIPT - PHASE 0\n`;
        res.rows.forEach(r => {
            sql += `\n-- ${r.proname}\n${r.def}\n`;
        });
        fs.writeFileSync('src/scripts/rollback_phase0.sql', sql);
        console.log(`✅ Rollback script created with ${res.rowCount} functions.`);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}
dump();
