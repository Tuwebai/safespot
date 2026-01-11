
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    try {
        console.log('🔌 Connecting to DB...');
        const client = await pool.connect();
        console.log('✅ Connected.');

        console.log('🔄 Altering password_hash to DROP NOT NULL...');

        await client.query(`
      ALTER TABLE user_auth ALTER COLUMN password_hash DROP NOT NULL;
    `);

        console.log('✅ password_hash is now nullable.');

        client.release();
        pool.end();
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
