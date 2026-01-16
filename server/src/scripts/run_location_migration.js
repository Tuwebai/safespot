import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env parent dirs
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runMigration() {
    console.log('🚀 Starting Enterprise Location Migration...');

    try {
        const migrationPath = path.join(__dirname, '../../../database/migration_add_location_to_users.sql');

        if (!fs.existsSync(migrationPath)) {
            throw new Error(`Migration file not found at: ${migrationPath}`);
        }

        const sql = fs.readFileSync(migrationPath, 'utf-8');

        // Dynamically import DB to ensure env is loaded
        const { DB } = await import('../utils/db.js');
        const db = DB.public();

        console.log('📦 Executing SQL...');
        await db.query(sql);

        console.log('✅ Migration completed successfully!');
        console.log('   - Added columns to anonymous_users');
        console.log('   - Backfilled data from notification_settings');
        console.log('   - Created performance index');

        process.exit(0);

    } catch (err) {
        console.error('❌ Migration Failed:', err);
        process.exit(1);
    }
}

runMigration();
