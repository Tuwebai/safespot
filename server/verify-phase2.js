import { realtimeEvents } from './src/utils/eventEmitter.js';
import redis from './src/config/redis.js';

const TEST_CHANNEL = 'SAFESPOT_REALTIME_BUS';
const REMOTE_EVENT = 'test-remote-event';
const REMOTE_PAYLOAD = { message: 'Enterprise Contract Test', timestamp: Date.now() };

async function verifyPhase2() {
    console.log('\n📡 STARTING REDIS PHASE 2 AUDIT (Enterprise Contract) 📡\n');
    let passed = false;

    // 1. Setup Listener on Local EventEmitter (Simulating SSE Client connection)
    const listenerPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Timeout: Did not receive remote event via Pub/Sub'));
        }, 5000);

        realtimeEvents.on(REMOTE_EVENT, (payload) => {
            clearTimeout(timeout);
            console.log('   ✅ RECEIVED: Local EventEmitter fired for remote event!');
            console.log('   📦 Payload:', payload);
            if (payload.message === REMOTE_PAYLOAD.message) {
                resolve(true);
            } else {
                reject(new Error('Payload mismatch'));
            }
        });
    });

    try {
        // 2. Simulate "Remote Node" publishing to Redis with STRICT CONTRACT
        console.log('1️⃣  Simulating "Remote Node" publishing to Redis...');

        // Wait a moment for subscription to be ready
        await new Promise(r => setTimeout(r, 1000));

        const simulataedRemoteMessage = JSON.stringify({
            eventId: 'test-uuid-1234-5678', // Strict ID
            origin: 'remote-instance-999',  // Strict Origin
            channel: REMOTE_EVENT,          // Strict Channel Name
            payload: REMOTE_PAYLOAD,        // Strict Payload
            timestamp: Date.now()           // Strict Timestamp
        });

        // Use raw redis client to publish (like another server would)
        if (!redis) throw new Error('Redis client not available');

        await redis.publish(TEST_CHANNEL, simulataedRemoteMessage);

        console.log('   📤 Published message to Redis:', simulataedRemoteMessage);

        // 3. Wait for Local Emitter to fire
        console.log('2️⃣  Waiting for Local Subscriber to bridge event...');
        await listenerPromise;

        console.log('\n✅✅✅ VERIFICATION PASSED: Contract Validated ✅✅✅');
        passed = true;
    } catch (error) {
        console.error('\n❌ VERIFICATION FAILED:', error.message);
    } finally {
        if (passed) process.exit(0);
        else process.exit(1);
    }
}

// Run verify
verifyPhase2();
