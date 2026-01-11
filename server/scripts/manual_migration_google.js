
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    try {
        console.log('🔌 Connecting to DB...');
        const client = await pool.connect();
        console.log('✅ Connected.');

        console.log('🔄 Applying Google Auth columns...');

        await client.query(`
      ALTER TABLE user_auth ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'email';
      ALTER TABLE user_auth ADD COLUMN IF NOT EXISTS provider_user_id VARCHAR(255);
      ALTER TABLE user_auth ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
    `);

        console.log('✅ Columns added (if not existed).');

        console.log('🔄 Checking/Adding Unique Constraint...');
        await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_auth_provider_unique') THEN
            ALTER TABLE user_auth ADD CONSTRAINT user_auth_provider_unique UNIQUE (provider, provider_user_id);
        END IF;
      END $$;
    `);

        console.log('✅ Constraint handled.');

        client.release();
        pool.end();
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
