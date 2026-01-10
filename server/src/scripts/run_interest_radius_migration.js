import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
    console.log('[MIGRATION] Starting interest_radius_meters migration...');
    try {
        const sqlPath = path.join(__dirname, '../../../database/migration_interest_radius.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        const result = await pool.query(sql);
        console.log('[MIGRATION] SUCCESS:', result);
    } catch (err) {
        console.error('[MIGRATION] FAILED:', err.message);
        if (err.message.includes('already exists')) {
            console.log('[MIGRATION] Column might already exist, skipping...');
        } else {
            process.exit(1);
        }
    } finally {
        process.exit(0);
    }
}

runMigration();
