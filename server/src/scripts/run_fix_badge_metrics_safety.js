
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

console.log('Environment loaded.');

async function runMigration() {
    const { queryWithRLS } = await import('../utils/rls.js');
    const { default: pool } = await import('../config/database.js');

    try {
        console.log('--- RUNNING SAFETY MIGRATION ---');
        const sqlPath = path.join(__dirname, '../../../database/fix_badge_metrics_safety.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await queryWithRLS(null, sql, []);
        console.log('✅ Migration applied successfully.');

    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        if (pool) pool.end();
        process.exit(0);
    }
}

runMigration();
