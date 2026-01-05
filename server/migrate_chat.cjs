const pg = require('pg');
const { Pool } = pg;

const connectionString = 'postgresql://postgres.womkvonfiwjzzatsowkl:JUANCHI101718@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        console.log('Running migration...');
        // 1. Drop constraints if they exist to avoid conflicts on re-run
        await pool.query('ALTER TABLE chat_rooms ALTER COLUMN report_id DROP NOT NULL');
        console.log(' - report_id made nullable');

        // 2. Drop old index if exists
        await pool.query('DROP INDEX IF EXISTS idx_chat_rooms_unique');
        console.log(' - Old index dropped');

        // 3. Create new index for DMs (participants unique where report_id is null)
        await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_rooms_dm ON chat_rooms (participant_a, participant_b) WHERE report_id IS NULL');
        console.log(' - DM index created');

        // 4. Create new index for Report Chats (report_id + participants unique)
        await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_rooms_report ON chat_rooms (report_id, participant_a, participant_b) WHERE report_id IS NOT NULL');
        console.log(' - Report Chat index created');

        console.log('✅ Migration successful');
        process.exit(0);
    } catch (e) {
        console.error('❌ Migration failed:', e);
        process.exit(1);
    }
}

migrate();
