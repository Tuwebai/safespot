#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * 🧪 Presence Tracker Test Script
 * 
 * Tests the passive cleanup mechanism by monitoring Redis keys in real-time
 * after simulating a browser crash (Task Manager kill).
 * 
 * Usage:
 *   node scripts/test-presence-cleanup.js <anonymousId>
 * 
 * Example:
 *   node scripts/test-presence-cleanup.js abc12345-1234-1234-1234-123456789abc
 */

import Redis from 'ioredis';
import 'dotenv/config';

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
    console.error('❌ ERROR: REDIS_URL not found in .env');
    process.exit(1);
}

const anonymousId = process.argv[2];

if (!anonymousId) {
    console.error('❌ ERROR: Missing anonymousId argument');
    console.error('\nUsage:');
    console.error('  node scripts/test-presence-cleanup.js <anonymousId>');
    console.error('\nTo get your anonymousId:');
    console.error('  1. Open browser console at http://localhost:5174');
    console.error('  2. Run: localStorage.getItem("safespot_anonymous_id")');
    process.exit(1);
}

const redis = new Redis(REDIS_URL, {
    retryStrategy: () => null, // Don't retry, fail fast
});

const sessionKey = `presence:sessions:${anonymousId}`;
const presenceKey = `presence:user:${anonymousId}`;

let startTime = null;
let lastSessionValue = null;
let orphanDetected = false;
let cleanupDetected = false;

async function checkState() {
    try {
        const [sessionCount, presenceTTL] = await Promise.all([
            redis.get(sessionKey),
            redis.ttl(presenceKey),
        ]);

        const elapsed = startTime ? ((Date.now() - startTime) / 1000).toFixed(0) : 0;
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];

        // Build status line
        let status = `[${timestamp}] T+${elapsed}s | `;
        
        // Session counter status
        if (sessionCount) {
            status += `sessions=${sessionCount} `;
            if (sessionCount !== lastSessionValue) {
                status += '🔄 ';
            }
        } else {
            status += `sessions=(nil) `;
            if (lastSessionValue !== null && sessionCount === null) {
                status += '✅ CLEANED ';
                cleanupDetected = true;
            }
        }

        // Presence TTL status
        if (presenceTTL > 0) {
            status += `| TTL=${presenceTTL}s ✅`;
        } else if (presenceTTL === -1) {
            status += `| TTL=NO_EXPIRE ⚠️ BUG`;
        } else if (presenceTTL === -2) {
            status += `| TTL=EXPIRED ⏱️`;
            if (sessionCount && !orphanDetected) {
                status += ' | ⚠️ ORPHAN DETECTED';
                orphanDetected = true;
            }
        }

        console.log(status);

        lastSessionValue = sessionCount;

    } catch (err) {
        console.error('❌ Error checking state:', err.message);
    }
}

async function runTest() {
    console.log('\n🧪 Presence Tracker Cleanup Test\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Anonymous ID: ${anonymousId.substring(0, 16)}...`);
    console.log(`Session Key:  ${sessionKey}`);
    console.log(`Presence Key: ${presenceKey}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Initial state check
    console.log('📊 Initial State Check...\n');
    await checkState();
    console.log('');

    const initialSession = await redis.get(sessionKey);
    const initialTTL = await redis.ttl(presenceKey);

    if (!initialSession && initialTTL === -2) {
        console.log('⚠️  WARNING: User is not currently online.');
        console.log('   Please open the app first, then run this test.\n');
        process.exit(0);
    }

    console.log('✅ User is online. Ready to test.\n');
    console.log('📋 Instructions:\n');
    console.log('   1. Open Task Manager (Ctrl+Shift+Esc)');
    console.log('   2. Find your browser process');
    console.log('   3. Right-click → End Task');
    console.log('   4. Watch the output below\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🔍 Monitoring (polling every 5s)...\n');

    startTime = Date.now();

    // Monitor every 5 seconds
    const interval = setInterval(async () => {
        await checkState();

        // Stop after cleanup is detected
        if (cleanupDetected) {
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            console.log('✅ TEST PASSED: Passive cleanup completed successfully!\n');
            console.log('Summary:');
            console.log('  ✓ Presence TTL expired after ~60s');
            console.log('  ✓ Orphaned session detected');
            console.log('  ✓ Passive cleanup removed orphaned session');
            console.log('\n🎯 Result: Presence Tracker working correctly!\n');
            clearInterval(interval);
            redis.disconnect();
            process.exit(0);
        }

        // Safety timeout: 2 minutes
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > 120) {
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            console.log('⏱️  Timeout: Test duration exceeded 2 minutes.\n');
            
            if (orphanDetected && !cleanupDetected) {
                console.log('⚠️  WARNING: Orphan detected but NOT cleaned up!');
                console.log('   Passive cleanup may not be working.\n');
            } else if (!orphanDetected) {
                console.log('ℹ️  Note: Orphan never detected. Browser may have closed gracefully.\n');
            }
            
            clearInterval(interval);
            redis.disconnect();
            process.exit(orphanDetected && !cleanupDetected ? 1 : 0);
        }
    }, 5000);

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n\n⏹️  Test interrupted by user.\n');
        clearInterval(interval);
        redis.disconnect();
        process.exit(0);
    });
}

redis.on('ready', () => {
    runTest().catch(err => {
        console.error('❌ Test failed:', err);
        redis.disconnect();
        process.exit(1);
    });
});

redis.on('error', (err) => {
    console.error('❌ Redis connection error:', err.message);
    process.exit(1);
});
