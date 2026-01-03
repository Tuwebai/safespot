import pool from '../config/database.js';

async function fixConstraints() {
    console.log('🔍 Starting notification constraints fix...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('⏳ Removing old check constraints...');
        // We try to drop them if they exist. The names are usually specific.
        // In migration_notifications.sql they are anonymous (part of column definition).
        // PostgreSQL usually names them: table_column_check

        await client.query(`
      ALTER TABLE notifications 
      DROP CONSTRAINT IF EXISTS notifications_type_check;
    `);

        await client.query(`
      ALTER TABLE notifications 
      DROP CONSTRAINT IF EXISTS notifications_entity_type_check;
    `);

        console.log('⏳ Adding updated check constraints...');

        await client.query(`
      ALTER TABLE notifications 
      ADD CONSTRAINT notifications_type_check 
      CHECK (type IN ('proximity', 'activity', 'similar', 'achievement', 'mention', 'like', 'follow', 'achievement_earned'));
    `);

        await client.query(`
      ALTER TABLE notifications 
      ADD CONSTRAINT notifications_entity_type_check 
      CHECK (entity_type IN ('report', 'comment', 'share', 'sighting', 'badge', 'user'));
    `);

        await client.query('COMMIT');
        console.log('✅ Notification constraints updated successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Failed to update constraints:', error.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

fixConstraints();
