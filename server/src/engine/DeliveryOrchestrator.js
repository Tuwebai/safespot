import { realtimeEvents } from '../utils/eventEmitter.js';
import { presenceTracker } from '../utils/presenceTracker.js';
import webpush from 'web-push';
import { sendPushNotification, createChatNotificationPayload, createActivityNotificationPayload } from '../utils/webPush.js';
import { eventDeduplicator } from './DeliveryLedger.js';
import { DispatchResult } from './NotificationDispatcher.js';
import { logError } from '../utils/logger.js';

/**
 * DeliveryOrchestrator
 * 
 * The Brain of the Notification System.
 * Decides the SINGLE best channel for delivery to avoid duplicates.
 * 
 * Policy:
 * 1. IF User uses App (Online) -> SEND SSE (Realtime)
 * 2. IF User is Away (Offline) -> SEND PUSH
 * 3. IF Security Alert -> SEND BOTH (Always Push)
 */
export const DeliveryOrchestrator = {

    /**
     * Route and Dispatch an event
     * @param {object} jobData - The full job data from the queue
     * @returns {Promise<string>} DispatchResult
     */
    async routeAndDispatch(jobData) {
        const { traceId, type, target, payload, delivery } = jobData;
        const anonymousId = target.anonymousId;

        if (!anonymousId) {
            // No target - permanent failure, no need to log (metric instead)
            return DispatchResult.PERMANENT_ERROR;
        }

        try {
            // 1. Check Presence (Single Source of Truth: Redis)
            const isOnline = await presenceTracker.isOnline(anonymousId);
            const isPriorityHigh = delivery?.priority === 'high';
            const isSecurity = type === 'SECURITY_ALERT';

            // 2. Decision Logic
            // SECURITY -> ALWAYS PUSH (Safety First)
            if (isSecurity) {
                if (process.env.DEBUG) console.log(`[Orchestrator][${traceId}] SECURITY ALERT: Forcing Push + SSE.`);
                this._dispatchSSE(jobData); // Try update UI if open
                return await this._dispatchPush(jobData); // Ensure wake up
            }

            // MESSAGING / ACTIVITY
            // 🧠 FASE 1 FIX: Single Channel Delivery
            // Push is for WAKE-UP only, not for delivery when user is online.
            // - Online: SSE (Realtime) - user has app open
            // - Offline: Push (WebPush) - wake up the device
            // This eliminates duplicate notifications and race conditions.

            if (isOnline) {
                // Routing decision - only log in debug
                await eventDeduplicator.markDispatched(jobData.id, 'sse');
                const sseResult = await this._dispatchSSE(jobData);
                return sseResult ? DispatchResult.SUCCESS : DispatchResult.RETRYABLE_ERROR;
            } else {
                // Routing decision - only log in debug
                await eventDeduplicator.markDispatched(jobData.id, 'push');
                return await this._dispatchPush(jobData);
            }

        } catch (err) {
            logError(err, { context: 'DeliveryOrchestrator', traceId });
            return DispatchResult.RETRYABLE_ERROR;
        }
    },

    /**
     * Internal: Send via SSE
     * Returns true if emitted (fire & forget assumption of success if online)
     */
    async _dispatchSSE(jobData) {
        const { type, target, payload } = jobData;
        const serverTimestamp = Date.now();

        // Map Job Type to SSE Channel/Event
        if (type === 'CHAT_MESSAGE') {
            await eventDeduplicator.markDispatched(jobData.id, 'sse');

            // ✅ ENTERPRISE CONTRACT: Send the full message object for frontend processing
            realtimeEvents.emitUserChatUpdate(target.anonymousId, {
                eventId: jobData.id,
                serverTimestamp,
                roomId: payload.data?.roomId,
                message: {
                    id: payload.entityId, // The real message ID from DB
                    conversation_id: payload.data?.roomId,
                    sender_id: payload.data?.senderId || 'system',
                    content: payload.message,
                    type: 'text',
                    created_at: new Date().toISOString(),
                    sender_alias: payload.data?.senderAlias,
                    is_read: false,
                    is_delivered: true
                },
                originClientId: 'orchestrator'
            });
            return true;
        }

        if (type === 'REPORT_ACTIVITY' || type === 'COMMENT_ACTIVITY' || type === 'FOLLOW_ACTIVITY' || type === 'MENTION_ACTIVITY') {
            await eventDeduplicator.markDispatched(jobData.id, 'sse');
            // General notification toast
            realtimeEvents.emitUserNotification(target.anonymousId, {
                eventId: jobData.id,
                serverTimestamp,
                type: 'activity',
                title: payload.title,
                message: payload.message,
                link: payload.data?.url,
                timestamp: serverTimestamp
            });
            return true;
        }

        // 🧠 ENTERPRISE FINAL CATCH-ALL
        if (payload?.title && payload?.message) {
            await eventDeduplicator.markDispatched(jobData.id, 'sse');
            realtimeEvents.emitUserNotification(target.anonymousId, {
                eventId: jobData.id,
                serverTimestamp,
                type: 'activity',
                title: payload.title,
                message: payload.message,
                link: payload.data?.url,
                timestamp: serverTimestamp
            });
            return true;
        }

        return false;
    },

    /**
     * Internal: Send via WebPush
     * Delegates to the existing WebPush logic but wraps it cleanly
     */
    async _dispatchPush(jobData) {
        // Reuse the logic we had in NotificationDispatcher, but moved here or called from here.
        // For minimal refactor valid for this task, we can import the logic or 
        // assume NotificationDispatcher calls US, but we need to call Push functions directly 
        // to avoid circular dependency if we kept logic in Dispatcher.
        // Solution: We move the push specific logic from Dispatcher to here or a helper.
        // Actually, let's keep it simple: Orchestrator calls the utils directly.

        const { traceId, type, target, payload } = jobData;

        // Resolve Subscriptions
        const { NotificationDispatcher } = await import('./NotificationDispatcher.js');
        // Warning: Circular dependency risk if Dispatcher imports Orchestrator. 
        // BETTER: Dispatcher calls Orchestrator. Orchestrator calls Utils. 
        // Dispatcher should just be a shell now.

        // We need the subscription resolution logic. To avoid duplicating code from Dispatcher,
        // we should expose `_resolveTargetSubscriptions` from dispatcher or move it to a service.
        // For now, let's assume we can access it or duplicate the simple query.

        // Let's implement the DB query here to decouple.
        const { DB } = await import('../utils/db.js');
        const db = DB.public();

        const result = await db.query(
            'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE anonymous_id = $1 AND is_active = true',
            [target.anonymousId]
        );
        const subscriptions = result.rows;

        if (!subscriptions || subscriptions.length === 0) {
            // No push sub -> Delivery 'succeeded' (nothing to do)
            return DispatchResult.SUCCESS;
        }

        // Prepare Payload
        let pushPayload;
        if (type === 'CHAT_MESSAGE') {
            pushPayload = createChatNotificationPayload({
                id: payload.entityId,
                room_id: payload.data?.roomId,
                senderAlias: payload.data?.senderAlias,
                content: payload.message,
                recipientAnonymousId: target.anonymousId
            }, { report_title: payload.data?.reportTitle });
        } else {
            pushPayload = createActivityNotificationPayload({
                type: (payload.data?.type || type).toLowerCase(), // 🚀 Standardize to lowercase (e.g. 'follow')
                title: payload.title,
                message: payload.message,
                reportId: payload.reportId,
                entityId: payload.entityId,
                eventId: jobData.id,
                deepLink: payload.data?.deepLink // 🚀 Pass deepLink if present
            });
        }

        // Send
        const results = await Promise.allSettled(subscriptions.map(sub =>
            sendPushNotification({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, pushPayload)
        ));

        // 🏛️ FASE 2: Track push_sent_at for notifications (not chat messages)
        const anySuccess = results.some(r => r.status === 'fulfilled' && r.value.success);
        if (anySuccess && type !== 'CHAT_MESSAGE' && payload.reportId) {
            // Fire-and-forget: Update push_sent_at for activity notifications
            // Uses report_id + anonymous_id as composite key for matching
            db.query(
                `UPDATE notifications 
                 SET push_sent_at = NOW() 
                 WHERE anonymous_id = $1 
                   AND report_id = $2 
                   AND push_sent_at IS NULL
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [target.anonymousId, payload.reportId]
            ).catch(err => {
                // Silent fail - tracking is best effort
                console.warn(`[Orchestrator] Failed to update push_sent_at: ${err.message}`);
            });
        }

        // Basic classification
        const allRetryable = results.every(r => r.status === 'rejected');
        return allRetryable ? DispatchResult.RETRYABLE_ERROR : DispatchResult.SUCCESS;
    }

    // 🏛️ ARCHITECTURAL FIX: _markAsDeliveredProactively ELIMINADO
    // El backend NO puede marcar delivered sin confirmación del cliente
    // ACK es responsabilidad EXCLUSIVA de RealtimeOrchestrator (frontend)
};
