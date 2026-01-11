

import jwt from 'jsonwebtoken';

const API_URL = 'http://localhost:3000/api';
// Secret from server/.env
const JWT_SECRET = 'sfsp_prod_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b';

async function runTests() {
    console.log('🛡️  STARTING PHASE 3 SECURITY CHECKS...\n');

    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        try {
            process.stdout.write(`Testing: ${name}... `);
            await fn();
            console.log('✅ PASS');
            passed++;
        } catch (e) {
            console.log('❌ FAIL');
            console.error('   Error:', e.message);
            failed++;
        }
    }

    // 1. Strict Auth: Invalid Token -> 401
    await test('Strict Auth: Invalid Token returns 401', async () => {
        const res = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': 'Bearer INVALID_TOKEN_XYZ' }
        });
        if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
        const data = await res.json();
        if (data.code !== 'INVALID_TOKEN') throw new Error('Expected error code INVALID_TOKEN');
    });

    // 2. Strict Auth: No Token -> 200 (Anonymous)
    await test('Strict Auth: No Token returns 200 (Anonymous)', async () => {
        const res = await fetch(`${API_URL}/auth/me`, {
            headers: { 'X-Anonymous-Id': '11111111-1111-1111-1111-111111111111' }
        });
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        const data = await res.json();
        if (data.authenticated === true) throw new Error('Should not be authenticated');
        if (data.anonymous_id !== '11111111-1111-1111-1111-111111111111') throw new Error('Should respect anonymous id when no token');
    });

    // 3. Anti-Spoofing: Token ID overrides Header ID
    await test('Anti-Spoofing: Token ID overrides Header ID', async () => {
        // Generate valid token for user A
        const tokenAnonId = 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA';
        const headerAnonId = 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB';

        const token = jwt.sign({
            auth_id: 'user_123',
            anonymous_id: tokenAnonId,
            email: 'test@test.com'
        }, JWT_SECRET);

        const res = await fetch(`${API_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Anonymous-Id': headerAnonId // Malicious header
            }
        });

        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        const data = await res.json();

        if (data.authenticated !== true) throw new Error('Should be authenticated');
        if (data.anonymous_id !== tokenAnonId) {
            throw new Error(`Spoofing Success! Server accepted ${data.anonymous_id} instead of forced ${tokenAnonId}`);
        }
    });

    // 4. Rate Limiting Check (Basic) - assumes default non-blocked
    // Just checking headers exist
    await test('Rate Limiting Headers Present', async () => {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'fake', password: 'fake' })
        });
        // Don't care about 400/401, just headers
        if (!res.headers.get('X-RateLimit-Limit-Minute')) throw new Error('X-RateLimit-Limit-Minute header missing');
    });

    console.log(`\n🎉 RESULTS: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) process.exit(1);
}

runTests();
