import pool from './config/database.js';

async function checkColumns() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'chat_messages' 
            ORDER BY ordinal_position
        `);
        console.log('Columns in chat_messages:');
        result.rows.forEach(c => {
            console.log(`  - ${c.column_name}: ${c.data_type}`);
        });
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
}

checkColumns();
