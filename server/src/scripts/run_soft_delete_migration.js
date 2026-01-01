import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runSoftDeleteMigration() {
    try {
        const sqlPath = path.join(__dirname, 'soft_delete_and_rls.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');

        console.log('--- Starting Soft Delete & RLS Hardening Migration ---');
        console.log('SQL File:', sqlPath);

        const { DB } = await import('../utils/db.js');
        const db = DB.public(); // Root-level access (doesn't set app.anonymous_id context)

        console.log('Executing migration...');
        await db.query(sql);

        console.log('--- Migration completed successfully ---');
        process.exit(0);
    } catch (err) {
        console.error('--- Migration failed ---');
        console.error(err);
        process.exit(1);
    }
}

runSoftDeleteMigration();
