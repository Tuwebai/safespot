import { presenceTracker } from '../utils/presenceTracker.js';
import { realtimeEvents } from '../utils/eventEmitter.js';
import { sendPushNotification, createChatNotificationPayload, createActivityNotificationPayload } from '../utils/webPush.js';
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
            if (isOnline) {
                console.log(`[Orchestrator] [${traceId}] User is ONLINE. Attempting Realtime delivery...`);
                const delivered = this._dispatchSSE(jobData);

                if (delivered) {
                    console.log(`[Orchestrator] [${traceId}] Realtime Handled. SKIPPING Push.`);
                    return DispatchResult.SUCCESS;
                } else {
                    console.warn(`[Orchestrator] [${traceId}] Realtime attempt failed (no local listeners?). Fallback to Push.`);
                    // Fallthrough to Push
                }
            } else {
                console.log(`[Orchestrator] [${traceId}] User is OFFLINE. Routing to Push.`);
            }

            // 3. Push Delivery (Fallback or Primary)
            return await this._dispatchPush(jobData);

        } catch (err) {
            logError(err, { context: 'DeliveryOrchestrator', traceId });
            return DispatchResult.RETRYABLE_ERROR;
        }
    },

    /**
     * Internal: Send via SSE
     * Returns true if emitted (fire & forget assumption of success if online)
     */
    _dispatchSSE(jobData) {
        const { type, target, payload } = jobData;

        // Map Job Type to SSE Channel/Event
        if (type === 'CHAT_MESSAGE') {
            realtimeEvents.emitUserChatUpdate(target.anonymousId, {
                type: 'new-message',
                roomId: payload.data?.roomId,
                content: payload.message,
                senderAlias: payload.data?.senderAlias,
                eventId: jobData.id, // Idempotency Key
                timestamp: Date.now()
            });
            return true;
        }

        if (type === 'REPORT_ACTIVITY' || type === 'COMMENT_ACTIVITY') {
            // General notification toast
            realtimeEvents.emitUserNotification(target.anonymousId, {
                type: 'activity',
                title: payload.title,
                message: payload.message,
                link: payload.data?.url,
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
                type: type, // 'follow', 'comment', etc
                title: payload.title,
                message: payload.message,
                reportId: payload.reportId,
                entityId: payload.entityId,
                ...payload.data
            });
        }

        // Send
        const results = await Promise.allSettled(subscriptions.map(sub =>
            sendPushNotification({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, pushPayload)
        ));

        // Basic classification
        const allRetryable = results.every(r => r.status === 'rejected');
        return allRetryable ? DispatchResult.RETRYABLE_ERROR : DispatchResult.SUCCESS;
    }
};
