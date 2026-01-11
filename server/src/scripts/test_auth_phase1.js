import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_URL = 'http://localhost:3000/api';

async function testAuth() {
    console.log('🧪 Starting Auth Phase 1 Verification...');

    // Load Pool dynamically ensuring ENV is loaded
    const { default: pool } = await import('../config/database.js');

    // 1. Generate Creds
    const anonymous_id = crypto.randomUUID();
    const email = `test.user.${Date.now()}@safespot.local`;
    const password = 'SafeSpotPassword123!';

    console.log(`📝 Generated: ${email} | ${anonymous_id}`);

    // PRE-REQ: Create the anonymous user in DB manually
    console.log('Inserting dummy anonymous user...');
    try {
        await pool.query("INSERT INTO anonymous_users (anonymous_id) VALUES ($1) ON CONFLICT DO NOTHING", [anonymous_id]);
    } catch (err) {
        console.error('DB Insert Error:', err);
        process.exit(1);
    }

    // 2. Register
    console.log('\n--- 1. Testing Registration ---');
    const regResponse = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, current_anonymous_id: anonymous_id })
    });

    const regData = await regResponse.json();
    console.log(`Status: ${regResponse.status}`);
    console.log('Response:', regData);

    if (!regData.success) {
        console.error('❌ Registration Failed');
        process.exit(1);
    }
    const token = regData.token;

    // 3. Login
    console.log('\n--- 2. Testing Login ---');
    const loginResponse = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    const loginData = await loginResponse.json();
    console.log(`Status: ${loginResponse.status}`);
    console.log('Response:', loginData);

    if (!loginData.success || loginData.anonymous_id !== anonymous_id) {
        console.error('❌ Login Failed or ID Mismatch');
        process.exit(1);
    }

    // 4. Test /me (Authenticated)
    console.log('\n--- 3. Testing /me (Authenticated) ---');
    const meAuthResponse = await fetch(`${API_URL}/auth/me`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const meAuthData = await meAuthResponse.json();
    console.log(`Status: ${meAuthResponse.status}`);
    console.log('Response:', meAuthData);

    if (meAuthData.anonymous_id !== anonymous_id) {
        console.error('❌ Middleware failed to inject anonymous_id from token');
        process.exit(1);
    } else {
        console.log('✅ Middleware correctly injected anonymous_id from token!');
    }

    // 5. Test /me (Anonymous Fallback)
    console.log('\n--- 4. Testing /me (Anonymous) ---');
    const randomAnon = crypto.randomUUID();
    const meAnonResponse = await fetch(`${API_URL}/auth/me`, {
        method: 'GET',
        headers: { 'X-Anonymous-Id': randomAnon }
    });

    const meAnonData = await meAnonResponse.json();
    console.log(`Status: ${meAnonResponse.status}`);
    console.log('Response:', meAnonData);

    if (meAnonData.anonymous_id !== randomAnon || meAnonData.authenticated) {
        console.error('❌ Anonymous fallback failed');
        process.exit(1);
    } else {
        console.log('✅ Anonymous fallback works!');
    }

    console.log('\n✨ ALL TESTS PASSED SUCCESSFULLY! ✨');
    pool.end();
}

testAuth().catch(err => {
    console.error(err);
    process.exit(1);
});
