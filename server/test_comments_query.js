import pool from './src/config/database.js';

const reportId = '9ff3001f-7d7c-478a-9cd3-540aa8699a8d';

async function test() {
    const client = await pool.connect();
    try {
        console.log('Testing Comments Query...');
        const query = `SELECT 
         c.id, c.report_id, c.anonymous_id, c.content, c.upvotes_count, c.created_at, c.updated_at, c.last_edited_at, c.parent_id, c.is_thread, c.is_pinned,
         u.avatar_url, u.alias,
         (c.upvotes_count >= 2 AND c.upvotes_count = MAX(c.upvotes_count) OVER()) as is_highlighted,
         (c.anonymous_id = r.anonymous_id) as is_author,
         (
           EXISTS (
             SELECT 1 FROM reports r2 
             WHERE r2.anonymous_id = c.anonymous_id 
             AND r2.deleted_at IS NULL
             AND (
               (r2.locality = r.locality AND r.locality IS NOT NULL) OR 
               (r2.zone = r.zone AND r.zone IS NOT NULL)
             )
           )
           OR
           EXISTS (
             SELECT 1 FROM user_zones uz
             WHERE uz.anonymous_id = c.anonymous_id
             AND r.longitude IS NOT NULL AND r.latitude IS NOT NULL
             AND ST_DWithin(
               ST_MakePoint(uz.lng, uz.lat)::geography,
               ST_MakePoint(r.longitude, r.latitude)::geography,
               COALESCE(uz.radius_meters, 1000)
             )
           )
         ) as is_local
       FROM comments c
       LEFT JOIN anonymous_users u ON c.anonymous_id = u.anonymous_id
       INNER JOIN reports r ON c.report_id = r.id
       WHERE c.report_id = $1 AND c.deleted_at IS NULL
       ORDER BY 
         c.is_pinned DESC NULLS LAST,
         CASE WHEN c.is_pinned THEN c.updated_at END DESC,
         c.created_at DESC
       LIMIT $2 OFFSET $3`;
        const res = await client.query(query, [reportId, 20, 0]);
        console.log('Success! Rows found:', res.rows.length);
        console.log('Sample row:', JSON.stringify(res.rows[0], null, 2));
    } catch (err) {
        console.error('FAILED:', err.message);
        if (err.stack) console.error(err.stack);
    } finally {
        client.release();
        process.exit();
    }
}

test();
