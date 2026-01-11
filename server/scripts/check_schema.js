
import pool from '../src/config/database.js';

async function checkColumns() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'user_auth';
        `);
        console.log('Columns in user_auth:', res.rows.map(r => r.column_name));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkColumns();
