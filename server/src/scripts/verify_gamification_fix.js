import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function verify() {
    const { getGamificationProfile } = await import('../utils/gamificationCore.js');

    // We need a test anonymous_id. Let's try to find one from the database or just use a dummy one to see the metrics structure.
    const { DB } = await import('../utils/db.js');
    const db = DB.public();
    const userRes = await db.query('SELECT anonymous_id FROM reports LIMIT 1');

    if (userRes.rows.length === 0) {
        console.log('No users found to test.');
        process.exit(0);
    }

    const anonymousId = userRes.rows[0].anonymous_id;
    console.log(`Verifying progress for user: ${anonymousId}`);

    const profile = await getGamificationProfile(anonymousId);

    console.log('\n--- Gamification Profile Summary ---');
    console.log(`Points: ${profile.profile.points}`);
    console.log(`Level: ${profile.profile.level}`);

    console.log('\n--- Badge Progress Verification ---');
    profile.badges.slice(0, 10).forEach(badge => {
        console.log(`Badge: ${badge.name} (${badge.category})`);
        console.log(`  Metric: ${badge.progress.current} / ${badge.progress.required} (${badge.progress.percent}%)`);
        if (badge.obtained) console.log('  [OBTAINED] ✅');
    });

    if (profile.nextAchievement) {
        console.log('\n--- Next Achievement ---');
        console.log(`Name: ${profile.nextAchievement.name}`);
        console.log(`Progress: ${profile.nextAchievement.progress.current} / ${profile.nextAchievement.progress.required}`);
    }

    process.exit(0);
}

verify();
