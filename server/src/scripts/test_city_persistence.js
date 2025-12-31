import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });
import { v4 as uuidv4 } from 'uuid';

async function testPersistence() {
    const testId = uuidv4();
    console.log(`Testing with ID: ${testId}`);

    const { DB } = await import('../utils/db.js');
    const db = DB.withContext(testId);

    // 1. Create User
    await db.query('INSERT INTO anonymous_users (anonymous_id) VALUES ($1)', [testId]);

    // 2. Upsert Settings with City/Province
    console.log('Upserting settings...');
    const city = 'Test City';
    const province = 'Test Province';

    // Simulate what the API does
    await db.query(`
        INSERT INTO notification_settings (anonymous_id, last_known_city, last_known_province, last_known_lat, last_known_lng)
        VALUES ($1, $2, $3, -34.6, -58.4)
        ON CONFLICT (anonymous_id) DO UPDATE SET
            last_known_city = EXCLUDED.last_known_city,
            last_known_province = EXCLUDED.last_known_province
    `, [testId, city, province]);

    // 3. Fetch Settings
    console.log('Fetching settings...');
    const result = await db.select('notification_settings', {
        where: { anonymous_id: testId },
        single: true
    });

    console.log('Result:', result);

    if (result.last_known_city === city && result.last_known_province === province) {
        console.log('✅ PASS: City/Province persisted correctly');
    } else {
        console.error('❌ FAIL: Data mismatch');
        process.exit(1);
    }

    // Cleanup
    await db.delete('anonymous_users', { anonymous_id: testId });
    process.exit(0);
}

testPersistence().catch(err => {
    console.error(err);
    process.exit(1);
});
