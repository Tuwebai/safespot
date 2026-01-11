
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function check() {
    try {
        const res = await pool.query("SELECT * FROM information_schema.tables WHERE table_name = 'user_auth'");
        if (res.rows.length > 0) {
            console.log('✅ Table user_auth EXISTS');
        } else {
            console.log('❌ Table user_auth DOES NOT EXIST');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}
check();
