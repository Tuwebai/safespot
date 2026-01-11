
import pool from '../src/config/database.js';

async function checkColumns() {
    try {
        console.log('--- Checking notification_settings ---');
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'notification_settings';
        `);
        console.log('Columns:', res.rows.map(r => r.column_name).join(', '));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkColumns();
