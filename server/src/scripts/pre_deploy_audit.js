
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function auditTriggers() {
    const client = await pool.connect();
    try {
        console.log('--- DB AUDIT START ---');

        // 1. Check is_official column and index
        const colCheck = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'anonymous_users' AND column_name = 'is_official';
        `);
        if (colCheck.rowCount === 0) {
            console.error('❌ COLUMN MISSING: anonymous_users.is_official');
        } else {
            console.log('✅ COLUMN EXISTS: anonymous_users.is_official');
        }

        const idxCheck = await client.query(`
            SELECT indexname FROM pg_indexes 
            WHERE tablename = 'anonymous_users' AND indexdef LIKE '%is_official%';
        `);
        if (idxCheck.rowCount === 0) {
            console.warn('⚠️ INDEX MISSING: anonymous_users.is_official (Performance might be impacted)');
        } else {
            console.log('✅ INDEX EXISTS: anonymous_users.is_official');
        }

        // 2. Get current trigger definitions
        const triggers = ['trigger_auto_moderation', 'trigger_recalculate_trust_score', 'trg_auto_recalc_score'];
        for (const trg of triggers) {
            const res = await client.query(`
                SELECT pg_get_triggerdef(oid) as def 
                FROM pg_trigger 
                WHERE tgname = $1;
            `, [trg]);
            if (res.rowCount > 0) {
                console.log(`\n--- TRIGGER: ${trg} ---\n${res.rows[0].def}`);
            } else {
                console.warn(`\n--- TRIGGER: ${trg} NOT FOUND ---`);
            }
        }

        // 3. Get function bodies
        const funcs = ['enforce_auto_moderation', 'trigger_recalculate_trust_score'];
        for (const func of funcs) {
            const res = await client.query(`
                SELECT pg_get_functiondef(p.oid) as def
                FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE p.proname = $1;
            `, [func]);
            if (res.rowCount > 0) {
                console.log(`\n--- FUNCTION: ${func} ---\n${res.rows[0].def}`);
            } else {
                console.warn(`\n--- FUNCTION: ${func} NOT FOUND ---`);
            }
        }

        console.log('\n--- DB AUDIT END ---');
    } catch (err) {
        console.error('Error during audit:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

auditTriggers();
