
import pool from '../src/config/database.js';

async function checkContentTables() {
    try {
        console.log('--- Checking reports ---');
        const res1 = await pool.query(`
            SELECT column_name
            FROM information_schema.columns 
            WHERE table_name = 'reports';
        `);
        console.log('Columns:', res1.rows.map(r => r.column_name).join(', '));

        console.log('\n--- Checking comments ---');
        const res2 = await pool.query(`
            SELECT column_name
            FROM information_schema.columns 
            WHERE table_name = 'comments';
        `);
        console.log('Columns:', res2.rows.map(r => r.column_name).join(', '));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkContentTables();
