import { DB } from '../utils/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    try {
        // Path relative to server/src/scripts
        // server/src/scripts -> server/src -> server -> Safespot -> database
        const migrationPath = path.join(__dirname, '../../../database/migration_notifications.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');

        console.log('Running migration...');
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
