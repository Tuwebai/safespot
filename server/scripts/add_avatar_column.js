
import pool from '../src/config/database.js';

async function migrate() {
    try {
        console.log('Adding avatar_url column to user_auth...');
        await pool.query(`
            ALTER TABLE user_auth 
            ADD COLUMN IF NOT EXISTS avatar_url TEXT;
        `);
        console.log('✅ Column added successfully');
        process.exit(0);
    } catch (e) {
        console.error('❌ Migration failed:', e);
        process.exit(1);
    }
}

migrate();
