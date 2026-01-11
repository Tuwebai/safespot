
import pool from '../src/config/database.js';

async function checkColumns() {
    try {
        console.log('--- Checking user_auth ---');
        const res1 = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'user_auth';
        `);
        console.log('Columns:', res1.rows.map(r => r.column_name).join(', '));

        console.log('\n--- Checking anonymous_users ---');
        const res2 = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'anonymous_users';
        `);
        console.log('Columns:', res2.rows.map(r => r.column_name).join(', '));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkColumns();
