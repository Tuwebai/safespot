import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runFixUserStatsMigration() {
    try {
        const sqlPath = path.join(__dirname, 'fix_user_stats_soft_delete.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');

        console.log('--- Starting User Stats Soft Delete Fix Migration ---');
        console.log('SQL File:', sqlPath);

        const { DB } = await import('../utils/db.js');
        const db = DB.public(); // Root-level access

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

runFixUserStatsMigration();
