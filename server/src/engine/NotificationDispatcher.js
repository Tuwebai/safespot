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
 * REFACTOR (v2): Now acts as a FACADE delegates logic to DeliveryOrchestrator
 * to handle single-channel delivery policy.
 */
export const NotificationDispatcher = {
    /**
     * Dispatch a single notification
     * @param {object} jobData The job data from the queue
     * @returns {Promise<string>} DispatchResult
     */
    async dispatch(jobData) {
        const { traceId, type, delivery } = jobData;

        try {
            // 🧠 ENTERPRISE: TTL Check (Discard old notifications if engine was down/saturated)
            if (delivery?.ttlSeconds) {
                const ageMs = Date.now() - jobData.createdAt;
                if (ageMs > delivery.ttlSeconds * 1000) {
                    console.warn(`[NotificationEngine] [${traceId}] Job expired (TTL: ${delivery.ttlSeconds}s). Discarding.`);
                    return DispatchResult.SUCCESS; // Success as in "Don't retry"
                }
            }

            // 🚀 DELEGATE TO ORCHESTRATOR
            // The Orchestrator decides: SSE vs Push based on Presence.
            const { DeliveryOrchestrator } = await import('./DeliveryOrchestrator.js');
            return await DeliveryOrchestrator.routeAndDispatch(jobData);

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
     * @deprecated Used by Orchestrator internally via duplicate query, keeping here just in case.
     */
    async _resolveTargetSubscriptions(target) {
        const { DB } = await import('../utils/db.js');
        const db = DB.public();

        let query = '';
        let params = [];

        if (target.anonymousId) {
            query = 'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE anonymous_id = $1 AND is_active = true';
            params = [target.anonymousId];
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
