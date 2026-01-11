import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
    console.log('[MIGRATION] Starting Chat Context Menu migration...');
    try {
        const sqlPath = path.join(__dirname, '../../../database/migrations/20260111_chat_context_menu.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log(`[MIGRATION] Reading SQL from: ${sqlPath}`);

        const result = await pool.query(sql);
        console.log('[MIGRATION] SUCCESS:', result);
    } catch (err) {
        console.error('[MIGRATION] FAILED:', err.message);
        // Don't exit with error if it's just duplicate columns (re-run safety)
        if (err.message.includes('already exists')) {
            console.log('[MIGRATION] Columns might already exist, skipping...');
        } else {
            console.error(err);
            process.exit(1);
        }
    } finally {
        process.exit(0);
    }
}

runMigration();
