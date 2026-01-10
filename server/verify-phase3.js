import { presenceTracker } from './src/utils/presenceTracker.js';
import redis from './src/config/redis.js';

const TEST_USER = 'test-presence-user-' + Date.now();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runVerification() {
    console.log('\n📡 STARTING REDIS PHASE 3 AUDIT (Distributed Presence) 📡\n');
    console.log(`[Test] User ID: ${TEST_USER}`);

    try {
        // 1. Check Initial State (Should be Offline)
        const initialStatus = await presenceTracker.isOnline(TEST_USER);
        console.log(`1️⃣  Initial Status (Should be false): ${initialStatus}`);
        if (initialStatus) throw new Error('User should be offline initially');

        // 2. Mark Online (Heartbeat Simulation)
        console.log('2️⃣  Simulating Heartbeat (markOnline)...');
        await presenceTracker.markOnline(TEST_USER);

        // 3. Verify Redis Key and TTL
        const isOnline = await presenceTracker.isOnline(TEST_USER);
        console.log(`   👉 isOnline(): ${isOnline}`);
        if (!isOnline) throw new Error('User should be online after heartbeat');

        const ttl = await redis.ttl(`presence:user:${TEST_USER}`);
        console.log(`   👉 Redis Key TTL: ${ttl}s`);
        if (ttl <= 0 || ttl > 60) throw new Error('TTL should be ~60s');

        // 4. Update TTL (Heartbeat 2)
        console.log('4️⃣  Simulating Heartbeat 2 (Refresh)...');
        await delay(2000);
        await presenceTracker.markOnline(TEST_USER);
        const ttl2 = await redis.ttl(`presence:user:${TEST_USER}`);
        console.log(`   👉 New TTL: ${ttl2}s`);
        if (ttl2 <= 55) throw new Error('TTL should have refreshed to ~60s');

        // 5. Mark Offline (Explicit Logout)
        console.log('5️⃣  Simulating Logout (markOffline)...');
        await presenceTracker.markOffline(TEST_USER);

        const isOnlineAfterLogout = await presenceTracker.isOnline(TEST_USER);
        console.log(`   👉 isOnline(): ${isOnlineAfterLogout}`);
        if (isOnlineAfterLogout) throw new Error('User should be offline after explicit logout');

        console.log('\n✅✅✅ VERIFICATION PASSED: Presence Logic Validated ✅✅✅\n');

    } catch (err) {
        console.error('\n❌ VERIFICATION FAILED:', err);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

// Wait for Redis connection
setTimeout(() => {
    if (redis.status === 'ready') {
        runVerification();
    } else {
        redis.on('ready', runVerification);
    }
}, 1000);
