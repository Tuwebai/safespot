import pool from '../config/database.js';

async function fixReportCommentCounts() {
    console.log('Starting Maintenance: Recalculate Report Comment Counts...');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('Updating reports.comments_count based on actual active comments...');

        const result = await client.query(`
            UPDATE reports r 
            SET comments_count = (
                SELECT count(*) 
                FROM comments c 
                WHERE c.report_id = r.id 
                AND c.deleted_at IS NULL
            )
        `);

        console.log(`Updated ${result.rowCount} reports.`);

        await client.query('COMMIT');
        console.log('Maintenance completed successfully. Counts are now synced.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Maintenance failed:', error);
    } finally {
        client.release();
        process.exit();
    }
}

fixReportCommentCounts();
