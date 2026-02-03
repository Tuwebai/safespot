
import { DB } from '../src/utils/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new DB();

async function runForceCleanup() {
    console.log('☢️  Ejecutando Force Cleanup (SQL)...');

    const sqlPath = path.join(__dirname, 'force_cleanup_admins.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        // We execute straight away. The file has BEGIN/COMMIT.
        await db.query(sql);
        console.log('✅ Force Cleanup aplicado con éxito.');

    } catch (error) {
        console.error('❌ Error executing SQL:', error);
        process.exit(1);
    }
    process.exit(0);
}

runForceCleanup();
