import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runMigration() {
    try {
        const migrationPath = path.join(__dirname, '../../../database/migration_add_report_id_to_notifications.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');

        console.log('Running migration to add report_id to notifications...');
        const { DB } = await import('../utils/db.js');
        const db = DB.public();
        await db.query(sql);
        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
