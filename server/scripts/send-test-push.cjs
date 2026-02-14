#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * 🔔 Send Test Push Notification
 * 
 * Tests push notification delivery for a specific user.
 * Useful for verifying presence tracking + push suppression logic.
 * 
 * Usage:
 *   node scripts/send-test-push.js <anonymousId> [message]
 * 
 * Example:
 *   node scripts/send-test-push.js 45c4f0ec-a02c-4672-9d33-6cb7fb43223d "Test notification"
 */

import 'dotenv/config';
import pool from '../src/config/database.js';
import { sendPushNotification } from '../src/utils/webPush.js';
import { presenceTracker } from '../src/utils/presenceTracker.js';

const anonymousId = process.argv[2];
const customMessage = process.argv[3] || '🧪 Test de notificación push desde script';

if (!anonymousId) {
    console.error('❌ ERROR: Missing anonymousId argument');
    console.error('\nUsage:');
    console.error('  node scripts/send-test-push.js <anonymousId> [message]');
    console.error('\nExample:');
    console.error('  node scripts/send-test-push.js 45c4f0ec-a02c-4672-9d33-6cb7fb43223d');
    process.exit(1);
}

async function sendTestPush() {
    console.log('\n🔔 Push Notification Test\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Target User: ${anonymousId.substring(0, 16)}...`);
    console.log(`Message: "${customMessage}"\n`);

    try {
        // Step 1: Check presence status
        console.log('📊 Step 1: Checking presence status...\n');
        const isOnline = await presenceTracker.isOnline(anonymousId);
        
        if (isOnline) {
            console.log('⚠️  User is ONLINE - Push will be SUPPRESSED');
            console.log('   Reason: User has active SSE connection\n');
            console.log('💡 Tip: Close all browser tabs for this user first.\n');
            process.exit(0);
        } else {
            console.log('✅ User is OFFLINE - Push will be SENT\n');
        }

        // Step 2: Get push subscriptions
        console.log('📊 Step 2: Fetching push subscriptions...\n');
        const result = await pool.query(
            `SELECT endpoint, p256dh, auth 
             FROM push_subscriptions 
             WHERE anonymous_id = $1 
             AND endpoint IS NOT NULL`,
            [anonymousId]
        );

        if (result.rows.length === 0) {
            console.log('❌ No push subscriptions found for this user');
            console.log('   User needs to enable push notifications in the app.\n');
            process.exit(1);
        }

        console.log(`Found ${result.rows.length} subscription(s)\n`);

        // Step 3: Send push to each subscription
        console.log('📊 Step 3: Sending push notifications...\n');
        
        const payload = {
            title: '🧪 Test Push Notification',
            body: customMessage,
            icon: '/logo-192.png',
            badge: '/badge-72.png',
            tag: 'test-notification',
            data: {
                type: 'test',
                url: '/',
            },
        };

        let sentCount = 0;
        let failedCount = 0;

        for (const sub of result.rows) {
            try {
                await sendPushNotification(
                    {
                        endpoint: sub.endpoint,
                        p256dh: sub.p256dh,
                        auth: sub.auth,
                    },
                    payload
                );
                sentCount++;
                console.log(`  ✅ Sent to: ${sub.endpoint.substring(0, 40)}...`);
            } catch (err) {
                failedCount++;
                console.log(`  ❌ Failed: ${err.message}`);
            }
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('📊 Results:\n');
        console.log(`  Sent: ${sentCount}`);
        console.log(`  Failed: ${failedCount}`);
        console.log(`  Total: ${result.rows.length}\n`);

        if (sentCount > 0) {
            console.log('✅ Push notification(s) sent successfully!');
            console.log('   Check your device/browser for the notification.\n');
            process.exit(0);
        } else {
            console.log('❌ All push notifications failed.\n');
            process.exit(1);
        }

    } catch (err) {
        console.error('\n❌ Error sending push notification:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

sendTestPush();
