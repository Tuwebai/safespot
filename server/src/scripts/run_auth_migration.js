
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pg;

// Robust SSL logic copied from config/database.js
const isSupabase = process.env.DATABASE_URL?.includes('supabase.co') ||
    process.env.DATABASE_URL?.includes('pooler.supabase.com');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isSupabase || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    console.log('🔌 Connecting to DB...');
    const client = await pool.connect();

    try {
        console.log('📄 Reading migration file...');
        const sqlPath = path.resolve(__dirname, '../../../database/migration_auth_system.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('🚀 Executing migration...');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');

        console.log('✅ Migration successful! user_auth table created.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err);
    } finally {
        client.release();
        pool.end();
    }
}

runMigration();
