import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function runIndexMigration() {
    console.log('🚀 Executing Unread Index Migration...\n');
    
    try {
        const sqlPath = path.join(process.cwd(), 'database/migrations/20260214_add_unread_index.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('📄 SQL Content:');
        console.log(sql);
        console.log('\nContinued execution...');

        await pool.query(sql);
        console.log('✅ Migration executed successfully!');
        
        // Verification
        const result = await pool.query(`
            SELECT indexname, indexdef
            FROM pg_indexes 
            WHERE indexname = 'idx_notifications_unread_count';
        `);
        console.table(result.rows);

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

runIndexMigration();
