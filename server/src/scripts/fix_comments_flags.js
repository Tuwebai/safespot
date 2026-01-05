import pool from '../config/database.js';

async function fixCommentsFlags() {
    console.log('Starting DB Migration: Add flags_count to comments...');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Add column if not exists
        console.log('Adding column...');
        await client.query(`
      ALTER TABLE comments 
      ADD COLUMN IF NOT EXISTS flags_count INTEGER DEFAULT 0;
    `);

        // 2. Backfill data
        console.log('Backfilling counts...');
        await client.query(`
      UPDATE comments c 
      SET flags_count = (
        SELECT count(*) 
        FROM comment_flags cf 
        WHERE cf.comment_id = c.id
      );
    `);

        await client.query('COMMIT');
        console.log('Migration completed successfully.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
    } finally {
        client.release();
        process.exit();
    }
}

fixCommentsFlags();
