import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function runSchemaHardening() {
    console.log('🚀 Executing Schema Hardening Migration...\n');
    
    try {
        const sqlPath = path.join(process.cwd(), 'database/migrations/20260214_harden_schema_created_at.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('📄 SQL Content:');
        console.log(sql);
        console.log('\nContinued execution...');

        await pool.query(sql);
        console.log('✅ Migration executed successfully!');
        
        // Verification
        const result = await pool.query(`
            SELECT column_name, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'notifications' 
            AND column_name = 'created_at';
        `);
        console.table(result.rows);

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

runSchemaHardening();
