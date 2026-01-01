import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from server/.env
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runMigration() {
    // Dynamic import to ensure env vars are loaded first
    const { DB } = await import('../utils/db.js');

    const sqlPath = path.join(__dirname, '../../../database/migration_gamification_v2.sql');

    console.log(`Reading migration file from: ${sqlPath}`);

    try {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Executing migration...');

        // Split by semicolons to verify basic structure, but execute as one block likely
        // Since it has BEGIN; COMMIT; blocks, we should execute it as a single query if the driver supports it.
        // pg driver usually supports multiple statements in one query.

        // Use public instance for migration (no specific RLS context needed for DDL)
        // IMPORTANT: pg driver allows multiple statements if configured, but queryWithRLS might expect single.
        // However, for this migration, let's try. If it fails on multiple statements, we might need to split.
        const db = DB.public();
        await db.query(sql);

        console.log('Migration executed successfully! 🚀');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
