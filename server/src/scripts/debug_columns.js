
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function inspectColumns() {
    try {
        const tables = ['report_flags', 'anonymous_trust_scores'];

        for (const table of tables) {
            console.log(`--- Columns for ${table} ---`);
            const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [table]);

            res.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));
            console.log('--------------------------------');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

inspectColumns();
