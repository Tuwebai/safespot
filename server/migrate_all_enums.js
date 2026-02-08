
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

async function runMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected.');

        // 0. report_status_enum
        const reportStatuses = [
            'abierto', 'en_progreso', 'resuelto', 'verificado', 'rechazado', 'archivado', 'pendiente'
        ];
        console.log('Syncing report_status_enum...');
        for (const val of reportStatuses) {
            await client.query(`ALTER TYPE report_status_enum ADD VALUE IF NOT EXISTS '${val}'`);
            console.log(`Checked report_status_enum: ${val}`);
        }

        // 1. user_action_type
        const userActions = [
            'LIKE_REPORT', 'UNLIKE_REPORT',
            'USER_VOTE_REPORT', 'USER_VOTE_COMMENT',
            'USER_UNVOTE_REPORT', 'USER_UNVOTE_COMMENT',
            'USER_DELETE_SELF_REPORT', 'USER_DELETE_SELF_COMMENT', 'USER_EDIT_SELF_REPORT',
            'USER_REPORT_CREATE'
        ];

        console.log('Syncing user_action_type...');
        for (const val of userActions) {
            await client.query(`ALTER TYPE user_action_type ADD VALUE IF NOT EXISTS '${val}'`);
            console.log(`Checked user_action_type: ${val}`);
        }

        // 2. moderation_action_type
        const modActions = [
            'ADMIN_RESTORE', 'ADMIN_HIDE', 'ADMIN_DISMISS_FLAGS', 'ADMIN_BAN',
            'ADMIN_REPORT_STATUS_CHANGE', 'ADMIN_DELETE', 'ADMIN_EDIT',
            'AUTO_HIDE', 'HIDE', 'RESTORE', 'SHADOW_BAN', 'AUTO_SHADOW_BAN',
            'SYSTEM_SHADOW_BAN', 'AUTO_HIDE_THRESHOLD'
        ];

        console.log('Syncing moderation_action_type...');
        for (const val of modActions) {
            await client.query(`ALTER TYPE moderation_action_type ADD VALUE IF NOT EXISTS '${val}'`);
            console.log(`Checked moderation_action_type: ${val}`);
        }

        console.log('✅ All enums synchronized.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
