import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function runMigration() {
    console.log('🚀 Executing Push Atomicity Migration...\n');
    
    try {
        // process.cwd() already points to server/
        const sqlPath = path.join(process.cwd(), 'database/migrations/20260214_add_push_atomicity_columns.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('📄 SQL Content:');
        console.log(sql);
        console.log('\nContinued execution...');

        await pool.query(sql);
        console.log('✅ Migration executed successfully!');
        
        // Verification
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'notifications' 
            AND column_name IN ('push_attempt_at', 'push_attempt_count');
        `);
        console.table(result.rows);

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

runMigration();
