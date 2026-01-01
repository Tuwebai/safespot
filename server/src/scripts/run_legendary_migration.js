
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runMigration() {
    // Dynamic import
    const { DB } = await import('../utils/db.js');

    const sqlPath = path.join(__dirname, '../../../database/migration_gamification_v3_legendary.sql');

    console.log(`Reading migration file from: ${sqlPath}`);

    try {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Executing LEGENDARY migration...');

        const db = DB.public();
        await db.query(sql);

        console.log('Legendary Expansion Applied Successfully! 🏆');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
