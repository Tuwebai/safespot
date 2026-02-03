
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function deploy() {
    const client = await pool.connect();
    try {
        console.log('🚀 [DEPLOY] Starting Atomic Deployment for Phase 0...');

        // Load Scripts
        const modPath = path.join(__dirname, 'src/scripts/enterprise_moderation_and_addresses.sql');
        const flagPath = path.join(__dirname, 'src/scripts/migration_flagging_structural.sql');

        const modSql = fs.readFileSync(modPath, 'utf8');
        const flagSql = fs.readFileSync(flagPath, 'utf8');

        await client.query('BEGIN');

        console.log('📜 Applying enterprise_moderation_and_addresses.sql...');
        await client.query(modSql);

        console.log('📜 Applying migration_flagging_structural.sql...');
        await client.query(flagSql);

        await client.query('COMMIT');

        console.log('✅ [DEPLOY] Phase 0 applied successfully.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ [DEPLOY] STAGING FAILED. Transaction rolled back.', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

deploy();
