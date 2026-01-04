import { queryWithRLS } from './src/utils/rls.js';
import dotenv from 'dotenv';
dotenv.config();

async function runMigration() {
    try {
        console.log('Adding is_pinned column...');
        await queryWithRLS('00000000-0000-0000-0000-000000000000', 'ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;');
        console.log('Success!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
