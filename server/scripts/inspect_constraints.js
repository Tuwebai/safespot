
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

async function inspectConstraints() {
    try {
        console.log('🔌 Connecting to DB...');
        const client = await pool.connect();

        console.log('🔍 Checking constraints on user_auth...');
        const res = await client.query(`
        SELECT conname, contype, pg_get_constraintdef(oid) 
        FROM pg_constraint 
        WHERE conrelid = 'user_auth'::regclass;
    `);

        console.log('Found constraints:');
        res.rows.forEach(r => console.log(`- ${r.conname} (${r.contype}): ${r.pg_get_constraintdef}`));

        client.release();
        pool.end();
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

inspectConstraints();
