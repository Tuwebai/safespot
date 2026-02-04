import pool from '../../src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigration() {
    const client = await pool.connect();
    try {
        console.log('--- ENTERPRISE MIGRATION: HARDENING v3.1 ---');
        const sqlPath = path.join(__dirname, '../../migrations/v1_db_hardening.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await client.query('BEGIN; SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
        await client.query(sql);
        await client.query('COMMIT');

        console.log('✅ Migration applied successfully.');
        process.exit(0);
    } catch (e) {
        if (client) await client.query('ROLLBACK');
        console.error('❌ Migration failed:', e.message);
        process.exit(1);
    } finally {
        client.release();
    }
}

applyMigration();
