
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pg;
const isSupabase = process.env.DATABASE_URL?.includes('supabase.co') || process.env.DATABASE_URL?.includes('pooler.supabase.com');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isSupabase || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runFix() {
    console.log('🔧 Running constraint fix...');
    try {
        const sql = fs.readFileSync(path.resolve(__dirname, '../../../database/fix_unique_anonymous_id.sql'), 'utf8');
        await pool.query(sql);
        console.log('✅ Constraint added: anonymous_id is now UNIQUE in user_auth.');
    } catch (err) {
        if (err.code === '23505') {
            console.log('⚠️ Constraint might already exist / Duplicate data found? (Error 23505)');
        } else if (err.code === '42710') {
            console.log('✅ Constraint already exists (Error 42710)');
        } else {
            console.error('❌ Error adding constraint:', err);
            // Don't exit 1 if it's just "already exists" but for others yes
            process.exit(1);
        }
    } finally {
        pool.end();
    }
}

runFix();
