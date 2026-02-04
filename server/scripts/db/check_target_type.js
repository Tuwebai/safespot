import 'dotenv/config';
import pool from '../../src/config/database.js';

async function checkTargetType() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT unnest(enum_range(NULL::vote_target_type)) as value
        `);
        console.table(res.rows);
    } catch (e) {
        // Try to guess the enum name if vote_target_type is not it
        try {
            const res2 = await client.query(`
                SELECT distinct target_type FROM votes
            `);
            console.table(res2.rows);
        } catch (e2) {
            console.error(e2);
        }
    } finally {
        client.release();
        await pool.end();
    }
}

checkTargetType();
