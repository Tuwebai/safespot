import { DB } from '../utils/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    try {
        // Path relative to server/src/scripts
        const migrationPath = path.join(__dirname, '../../../database/migration_chats.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');

        console.log('🚀 Running Chat Migration...');
        const db = DB.public();

        // Execute the entire SQL script
        // Note: db.query uses queryWithRLS which handles the connection
        await db.query(sql);

        console.log('✅ Chat migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
