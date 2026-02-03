
import pg from 'pg';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function verify() {
    const client = await pool.connect();
    try {
        console.log('🧪 Starting Post-Deploy Verification (STAGING)...');

        // 0. Setup: Create Official and Normal Users
        const officialId = uuidv4();
        const normalId = uuidv4();

        console.log('1. Setting up test users...');
        await client.query(`
            INSERT INTO anonymous_users (anonymous_id, is_official) 
            VALUES ($1, true), ($2, false)
        `, [officialId, normalId]);

        // 1. Test: Official Immunity on Reports
        console.log('2. Testing Official Immunity on Reports...');
        const offReportRes = await client.query(`
            INSERT INTO reports (title, description, anonymous_id, is_hidden, category, location, zone, address, flags_count)
            VALUES ($1, $2, $3, false, 'security', ST_SetSRID(ST_MakePoint(0,0), 4326), 'Staging', 'Deploy Test Off', 0)
            RETURNING id
        `, ['Official Test', 'Content', officialId]);
        const offReportId = offReportRes.rows[0].id;

        // Reach 5 flags
        await client.query('UPDATE reports SET flags_count = 10 WHERE id = $1', [offReportId]);
        const offVerify = await client.query('SELECT is_hidden FROM reports WHERE id = $1', [offReportId]);

        if (offVerify.rows[0].is_hidden === false) {
            console.log('✅ Official Immunity OK: Report with 10 flags stays visible.');
        } else {
            throw new Error('❌ Official Immunity Failed: Official report was hidden.');
        }

        // 2. Test: Normal Report Trigger
        console.log('3. Testing Normal Report Auto-Moderation...');
        const normReportRes = await client.query(`
            INSERT INTO reports (title, description, anonymous_id, is_hidden, category, location, zone, address, flags_count)
            VALUES ($1, $2, $3, false, 'security', ST_SetSRID(ST_MakePoint(0,0), 4326), 'Staging', 'Deploy Test Norm', 0)
            RETURNING id
        `, ['Normal Test', 'Content', normalId]);
        const normReportId = normReportRes.rows[0].id;

        await client.query('UPDATE reports SET flags_count = 6 WHERE id = $1', [normReportId]);
        const normVerify = await client.query('SELECT is_hidden FROM reports WHERE id = $1', [normReportId]);

        if (normVerify.rows[0].is_hidden === true) {
            console.log('✅ Auto-Moderation OK: Normal report with 6 flags was hidden.');
        } else {
            throw new Error('❌ Auto-Moderation Failed: Normal report stayed visible.');
        }

        // 3. Test: Official Trust Score Immunity
        console.log('4. Testing Official Trust Score Immunity...');
        // Initialize trust scores (Using UPSERT because triggers might have already created them)
        await client.query(`
            INSERT INTO anonymous_trust_scores (anonymous_id, trust_score, flags_received_count) 
            VALUES ($1, 100, 0), ($2, 100, 0)
            ON CONFLICT (anonymous_id) DO UPDATE SET trust_score = 100, flags_received_count = 0
        `, [officialId, normalId]);

        // Add flags to official user
        await client.query('UPDATE anonymous_trust_scores SET flags_received_count = 20 WHERE anonymous_id = $1', [officialId]);
        // Trigger recalc
        const offTrustVerify = await client.query('SELECT trust_score, moderation_status FROM anonymous_trust_scores WHERE anonymous_id = $1', [officialId]);

        console.log(`   Official Trust Score: ${offTrustVerify.rows[0].trust_score}, Status: ${offTrustVerify.rows[0].moderation_status}`);
        if (offTrustVerify.rows[0].moderation_status === 'active') {
            console.log('✅ Trust Immunity OK: Official stays "active" despite flags.');
        } else {
            throw new Error('❌ Trust Immunity Failed: Official was shadow_banned.');
        }

        console.log('\n🌟 ALL STAGING VERIFICATIONS PASSED 🌟');

        // Cleanup
        await client.query('DELETE FROM reports WHERE id IN ($1, $2)', [offReportId, normReportId]);
        await client.query('DELETE FROM anonymous_trust_scores WHERE anonymous_id IN ($1, $2)', [officialId, normalId]);
        await client.query('DELETE FROM anonymous_users WHERE anonymous_id IN ($1, $2)', [officialId, normalId]);

    } catch (err) {
        console.error('❌ Verification Failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

verify();
