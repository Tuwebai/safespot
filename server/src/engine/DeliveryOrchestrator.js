import { presenceTracker } from '../utils/presenceTracker.js';
import { realtimeEvents } from '../utils/eventEmitter.js';
import { sendPushNotification, createChatNotificationPayload, createActivityNotificationPayload } from '../utils/webPush.js';
import { deliveryLedger } from './DeliveryLedger.js';
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
            console.warn(`[Orchestrator] [${traceId}] Skipped: No target anonymousId.`);
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
                console.log(`[Orchestrator] [${traceId}] SECURITY ALERT: Forcing Push + SSE.`);
                this._dispatchSSE(jobData); // Try update UI if open
                return await this._dispatchPush(jobData); // Ensure wake up
            }

            // MESSAGING / ACTIVITY
            // 🧠 ENTERPRISE FIX: DUAL DELIVERY ARCHITECTURE
            // We NO LONGER suppress Push based on "Online" status (Redis is soft-state and unreliable for exact socket connectivity).
            // Strategy: Send BOTH (SSE + Push). 
            // - If user is truly online: App consumes SSE. Service Worker suppresses Push (if focused).
            // - If user is background/dead socket: Push ensures delivery.

            if (isOnline) {
                console.log(`[Orchestrator] [${traceId}] User "Online" in Redis. Sending SSE...`);
                // 1. Mark as dispatched via SSE
                await deliveryLedger.markDispatched(jobData.id, 'sse');

                // 2. Send Realtime (Best Effort)
                this._dispatchSSE(jobData);

                // 3. Fallthrough to Push (Guaranteed Delivery)
                console.log(`[Orchestrator] [${traceId}] Proceeding to Push (Dual Strategy) to ensure delivery.`);
            } else {
                console.log(`[Orchestrator] [${traceId}] User OFFLINE. Routing to Push.`);
                await deliveryLedger.markDispatched(jobData.id, 'push');
            }

            // 3. Push Delivery (Fallback or Primary)
            const pushResult = await this._dispatchPush(jobData);

            // 🧠 ENTERPRISE OPTIMISM: If Push or SSE succeeded, mark as DELIVERED in DB and notify sender.
            // This satisfies the user expectation: "Notified = Delivered".
            if (pushResult === DispatchResult.SUCCESS || isOnline) {
                this._markAsDeliveredProactively(jobData);
            }

            return pushResult;

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

        // Map Job Type to SSE Channel/Event
        if (type === 'CHAT_MESSAGE') {
            await deliveryLedger.markDispatched(jobData.id, 'sse');

            // ✅ ENTERPRISE CONTRACT: Send the full message object for frontend processing
            realtimeEvents.emitUserChatUpdate(target.anonymousId, {
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
            await deliveryLedger.markDispatched(jobData.id, 'sse');
            // General notification toast
            realtimeEvents.emitUserNotification(target.anonymousId, {
                type: 'activity',
                title: payload.title,
                message: payload.message,
                link: payload.data?.url,
                timestamp: Date.now(),
                eventId: jobData.id
            });
            return true;
        }

        // 🧠 ENTERPRISE FINAL CATCH-ALL
        // If we don't know the type specifically but it has a title/message, send it as generic activity.
        // This ensures NO notification is "invisible" if the App supresses the Push.
        if (payload?.title && payload?.message) {
            await deliveryLedger.markDispatched(jobData.id, 'sse');
            realtimeEvents.emitUserNotification(target.anonymousId, {
                type: 'activity',
                title: payload.title,
                message: payload.message,
                link: payload.data?.url,
                timestamp: Date.now(),
                eventId: jobData.id
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

        // Basic classification
        const allRetryable = results.every(r => r.status === 'rejected');
        return allRetryable ? DispatchResult.RETRYABLE_ERROR : DispatchResult.SUCCESS;
    },

    /**
     * Proactively mark a message as delivered once the server confirms dispatch.
     * This ensures the sender sees the double tick as soon as the notification hits FCM or SSE.
     */
    async _markAsDeliveredProactively(jobData) {
        if (jobData.type !== 'CHAT_MESSAGE') return;

        const messageId = jobData.payload?.entityId;
        const recipientId = jobData.target?.anonymousId;

        if (!messageId || !recipientId) return;

        try {
            const { DB } = await import('../utils/db.js');
            const db = DB.public();

            // 1. Mark in DB (Idempotent)
            const result = await db.query(
                `UPDATE chat_messages 
                 SET is_delivered = true 
                 WHERE id = $1 AND is_delivered = false 
                 RETURNING sender_id, conversation_id`,
                [messageId]
            );

            if (result.rowCount > 0) {
                const message = result.rows[0];

                // 2. Notify Sender (User Channel)
                realtimeEvents.emitMessageDelivered(message.sender_id, {
                    messageId: messageId,
                    id: messageId,
                    conversationId: message.conversation_id,
                    deliveredAt: new Date().toISOString(),
                    receiverId: recipientId,
                    traceId: `proactive_${jobData.traceId}`
                });

                // 3. Notify Room (Active Window Sync)
                realtimeEvents.emitChatStatus('delivered', message.conversation_id, {
                    messageId: messageId,
                    receiverId: recipientId
                });

                console.log(`[PROACTIVE-ACK] [${jobData.traceId}] Message ${messageId} confirmed delivered to sender ${message.sender_id?.substring(0, 8)}`);
            } else {
                console.log(`[PROACTIVE-ACK] [${jobData.traceId}] Message ${messageId} already marked delivered. Skipping.`);
            }
        } catch (err) {
            console.error('[Orchestrator] Failed proactive delivery mark:', err.message);
        }
    }
};
