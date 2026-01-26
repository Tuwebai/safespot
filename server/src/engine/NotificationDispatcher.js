import { sendPushNotification, createActivityNotificationPayload } from '../utils/webPush.js';
import { logError } from '../utils/logger.js';

/**
 * DispatchResult constants for enterprise error classification
 */
export const DispatchResult = {
    SUCCESS: 'SUCCESS',
    RETRYABLE_ERROR: 'RETRYABLE_ERROR',   // 5xx, timeouts, 429
    PERMANENT_ERROR: 'PERMANENT_ERROR',   // 410, invalid payload, 401
};

/**
 * NotificationDispatcher
 * 
 * High-reliability layer for physical notification delivery.
 * Handles rate limiting, protocol-specific formatting, and error classifications.
 */
export const NotificationDispatcher = {
    /**
     * Dispatch a single notification
     * @param {object} jobData The job data from the queue
     * @returns {Promise<string>} DispatchResult
     */
    async dispatch(jobData) {
        const { traceId, type, target, payload, delivery } = jobData;

        try {
            // 🧠 ENTERPRISE: TTL Check (Discard old notifications if engine was down/saturated)
            if (delivery?.ttlSeconds) {
                const ageMs = Date.now() - jobData.createdAt;
                if (ageMs > delivery.ttlSeconds * 1000) {
                    console.warn(`[NotificationEngine] [${traceId}] Job expired (TTL: ${delivery.ttlSeconds}s). Discarding.`);
                    this._recordMetric('notifications.discarded', { reason: 'ttl_expired', type });
                    return DispatchResult.SUCCESS; // Success as in "Don't retry"
                }
            }

            console.log(`[NotificationEngine] [${traceId}] Dispatching ${type} [Priority: ${delivery?.priority || 'normal'}]`);

            // 1. Resolve Subscriptions
            const subscriptions = await this._resolveTargetSubscriptions(target);
            if (!subscriptions || subscriptions.length === 0) {
                console.warn(`[NotificationEngine] [${traceId}] Skipping: No active push subscriptions found for target ${JSON.stringify(target)}`);
                this._recordMetric('notifications.skipped', { reason: 'no_subscriptions', type });
                return DispatchResult.SUCCESS;
            }

            // 2. Prepare Payload
            let pushPayload;
            if (type === 'CHAT_MESSAGE') {
                const { createChatNotificationPayload } = await import('../utils/webPush.js');
                pushPayload = createChatNotificationPayload({
                    id: payload.entityId,
                    room_id: payload.data?.roomId,
                    senderAlias: payload.data?.senderAlias || 'Alguien',
                    content: payload.message,
                    recipientAnonymousId: target.anonymousId
                }, { report_title: payload.data?.reportTitle });
            } else {
                pushPayload = createActivityNotificationPayload({
                    type: type,
                    title: payload.title,
                    message: payload.message,
                    reportId: payload.reportId,
                    entityId: payload.entityId,
                    ...payload.data
                });
            }

            // 3. Physical Dispatch
            const results = await Promise.allSettled(subscriptions.map(async (sub) => {
                try {
                    await sendPushNotification(
                        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                        pushPayload
                    );
                    this._recordMetric('notifications.dispatched', { type });
                    return DispatchResult.SUCCESS;
                } catch (err) {
                    const statusCode = err.statusCode || (err.endpoint && err.statusCode);

                    // 🔴 ENTERPRISE: Classification Logic
                    if (statusCode === 410 || statusCode === 404) {
                        await this._cleanupInvalidSubscription(sub.id);
                        this._recordMetric('notifications.failed.permanent', { code: statusCode, type });
                        return DispatchResult.PERMANENT_ERROR;
                    }

                    if (statusCode === 429 || statusCode >= 500 || !statusCode) {
                        this._recordMetric('notifications.failed.retryable', { code: statusCode || 'network', type });
                        throw err; // Trigger retryable catch block
                    }

                    this._recordMetric('notifications.failed.permanent', { code: statusCode, type });
                    return DispatchResult.PERMANENT_ERROR;
                }
            }));

            // Classification logic to tell Worker if it should retry the whole job
            const allRetryable = results.every(r => r.status === 'rejected');
            if (allRetryable) {
                return DispatchResult.RETRYABLE_ERROR;
            }

            return DispatchResult.SUCCESS;

        } catch (err) {
            logError(err, { context: 'NotificationDispatcher', traceId, type });
            return DispatchResult.RETRYABLE_ERROR;
        }
    },

    _recordMetric(name, tags = {}) {
        // 🧠 Hook for future metrics engine
    },

    /**
     * Private: Fetch active push subscriptions from DB based on target
     */
    async _resolveTargetSubscriptions(target) {
        const { DB } = await import('../utils/db.js');
        const db = DB.public();

        let query = '';
        let params = [];

        if (target.anonymousId) {
            query = 'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE anonymous_id = $1 AND is_active = true';
            params = [target.anonymousId];
        } else if (target.userId) {
            // Placeholder for Motor 2: Link anonymous_ids to userId
            // For now, if no anonymousId is provided but userId is, we might need a lookup table.
            return [];
        } else {
            return [];
        }

        const result = await db.query(query, params);
        return result.rows;
    },

    /**
     * Private: Cleanup invalid/expired subscriptions (410 Gone)
     */
    async _cleanupInvalidSubscription(subId) {
        const { DB } = await import('../utils/db.js');
        const db = DB.public();
        await db.query('UPDATE push_subscriptions SET is_active = false, updated_at = NOW() WHERE id = $1', [subId]);
        console.log(`[NotificationEngine] Subscription ${subId} marked as inactive (410/404).`);
    }
};
