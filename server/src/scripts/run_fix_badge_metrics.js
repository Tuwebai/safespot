import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runFix() {
    const { DB } = await import('../utils/db.js');
    const sqlPath = path.join(__dirname, '../../../database/fix_badge_metrics.sql');

    try {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Executing database fix...');
        const db = DB.public();
        await db.query(sql);
        console.log('Database fixed successfully! 🚀');
        process.exit(0);
    } catch (error) {
        console.error('Fix failed:', error);
        process.exit(1);
    }
}

runFix();
