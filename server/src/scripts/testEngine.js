import { NotificationQueue } from '../engine/NotificationQueue.js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Enterprise Engine Test Script
 * 
 * Purpose: Smoke test for the new Notification Engine v1.
 * Usage: node src/scripts/testEngine.js [anonymousId]
 */
async function runTest() {
    const targetId = process.argv[2] || 'b5ea9ebc-6ab0-4eb1-8a85-c70b8591a0ba';
    console.log(`\n🚀 [TestEngine] Starting Smoke Test for target: ${targetId}`);
    console.log('----------------------------------------------------------');

    const traceId = `test-${Date.now()}`;

    // 1. Test Activity Notification (Normal Priority)
    console.log('1️⃣ Enqueuing ACTIVITY notification...');
    const job1 = await NotificationQueue.enqueue({
        traceId,
        type: 'ACTIVITY',
        target: { anonymousId: targetId },
        delivery: { priority: 'normal', ttlSeconds: 3600 },
        payload: {
            title: '🧪 Test: Notificación de Actividad',
            message: 'Si ves esto, el motor está procesando colas correctamente.',
            reportId: 'test-report-id',
            entityId: 'test-entity-id'
        }
    });

    // 2. Test Chat Message (High Priority)
    console.log('2️⃣ Enqueuing CHAT_MESSAGE notification...');
    const job2 = await NotificationQueue.enqueue({
        traceId,
        type: 'CHAT_MESSAGE',
        target: { anonymousId: targetId },
        delivery: { priority: 'high', ttlSeconds: 1800 },
        payload: {
            title: '💬 Test: Mensaje de Chat',
            message: 'Este mensaje tiene prioridad alta.',
            entityId: uuidv4(),
            data: {
                roomId: 'test-room-id',
                senderAlias: 'Arquitecto'
            }
        }
    });

    console.log('\n✅ [TestEngine] Enqueue completed.');
    console.log(`📊 Check your Terminal Logs for [NotificationEngine] [${traceId}] events.`);
    console.log('Wait 5 seconds for processing...\n');

    setTimeout(() => {
        console.log('🏁 Test script finished. If you saw the "COMPLETED" logs in the server console, it works!');
        process.exit(0);
    }, 5000);
}

runTest().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
