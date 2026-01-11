
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from server/.env
dotenv.config({ path: path.join(__dirname, '../../.env') });

console.log('Environment loaded.');

async function runTest() {
    // Dynamic import after env is loaded
    const { calculateUserGamification } = await import('../utils/gamificationCore.js');
    const { queryWithRLS } = await import('../utils/rls.js');
    const { default: pool } = await import('../config/database.js');

    const anonymousId = '00000000-0000-0000-0000-000000000000'; // Test ID

    try {
        console.log('--- STARTING REPRO TEST ---');

        // 1. Clean up
        await queryWithRLS(null, "DELETE FROM comments WHERE anonymous_id = $1", [anonymousId]);
        await queryWithRLS(null, "DELETE FROM user_badges WHERE anonymous_id = $1", [anonymousId]);
        await queryWithRLS(null, "DELETE FROM anonymous_users WHERE anonymous_id = $1", [anonymousId]);
        await queryWithRLS(null, "DELETE FROM reports WHERE id = '11111111-1111-1111-1111-111111111111'", []);

        // 2. Create user
        await queryWithRLS(null, "INSERT INTO anonymous_users (anonymous_id) VALUES ($1)", [anonymousId]);

        // 3. Insert 15 comments
        console.log('Inserting 15 comments...');
        for (let i = 0; i < 15; i++) {
            if (i === 0) {
                await queryWithRLS(anonymousId, `
                    INSERT INTO reports (id, anonymous_id, title, description, latitude, longitude, zone, category, address)
                    VALUES ('11111111-1111-1111-1111-111111111111', $1, 'Test', 'Test', 0, 0, 'Test', 'infrastructure', 'Test Address')
                    ON CONFLICT (id) DO NOTHING
                 `, [anonymousId]);
            }

            await queryWithRLS(anonymousId, `
                INSERT INTO comments (anonymous_id, report_id, content)
                VALUES ($1, '11111111-1111-1111-1111-111111111111', 'Comment ${i}')
             `, [anonymousId]);
        }

        // 4. Run Calc
        console.log('Calculating Gamification...');
        const result = await calculateUserGamification(anonymousId);

        // 5. Inspect Results
        const debatiente = result.badges.find(b => b.code === 'COM_3'); // Debatiente (15)
        const analista = result.badges.find(b => b.code === 'COM_4');   // Analista (40)

        // console.log('METRICS:', result.metrics);

        console.log('BADGE: Debatiente (Expect Obtained)');
        console.log(JSON.stringify(debatiente, null, 2));

        console.log('BADGE: Analista (Expect 15/40)');
        console.log(JSON.stringify(analista, null, 2));

        if (analista && analista.progress.current === 15) {
            console.log('✅ TEST PASSED: Analista correctly shows 15/40');
        } else {
            console.log(`❌ TEST FAILED: Analista shows ${analista ? analista.progress.current : 'N/A'}/40`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        if (pool) pool.end();
        process.exit(0);
    }
}

runTest();
