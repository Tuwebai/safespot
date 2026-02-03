import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('🔌 Connected to Database.');

        // 0. Seed System User (Essential for FKs)
        const seedPath = path.join(__dirname, 'seed_system_user.sql');
        if (fs.existsSync(seedPath)) {
            console.log('📜 Running migration: seed_system_user.sql');
            const sql = fs.readFileSync(seedPath, 'utf8');
            await client.query(sql);
            console.log('✅ System user seeded.');
        } else {
            console.warn('⚠️ seed_system_user.sql not found.');
        }

        // 1. Audit Table Migration
        const auditPath = path.join(__dirname, 'migration_moderation_audit.sql');
        if (fs.existsSync(auditPath)) {
            console.log('📜 Running migration: migration_moderation_audit.sql');
            const sql = fs.readFileSync(auditPath, 'utf8');
            await client.query(sql);
            console.log('✅ Audit table migration applied.');
        } else {
            console.error('❌ Audit migration file not found.');
        }

        // 2. FK Fix Migration
        const fkPath = path.join(__dirname, 'fix_moderation_fks.sql');
        if (fs.existsSync(fkPath)) {
            console.log('📜 Running migration: fix_moderation_fks.sql');
            const sql = fs.readFileSync(fkPath, 'utf8');
            await client.query(sql);
            console.log('✅ FK fix migration applied.');
        } else {
            console.warn('⚠️ FK fix migration file not found (skipping).');
        }

    } catch (err) {
        console.error('❌ Migration Failed:', err);
    } finally {
        client.release();
        await pool.end();
        console.log('🔌 Disconnected.');
    }
}

runMigration();
