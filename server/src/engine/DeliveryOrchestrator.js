import { realtimeEvents } from '../utils/eventEmitter.js';
import { presenceTracker } from '../utils/presenceTracker.js';
// webpush is imported by webPush.js utilities
// import webpush from 'web-push';
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
            return DispatchResult.PERMANENT_ERROR;
        }

        try {
            // 1. Check Presence (Single Source of Truth: Redis)
            const isOnline = await presenceTracker.isOnline(anonymousId);
            const _isPriorityHigh = delivery?.priority === 'high'; // Reserved for future use
            const isSecurity = type === 'SECURITY_ALERT';

            // 2. Decision Logic
            // SECURITY -> ALWAYS PUSH (Safety First)
            if (isSecurity) {
                if (process.env.DEBUG) {
                    console.log(`[Orchestrator][${traceId}] SECURITY ALERT: Forcing Push + SSE.`);
                }
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
                // 🏛️ FASE 3: Deduplication - Verify push not already sent
                // Only for activity notifications (not chat messages)
                if (type !== 'CHAT_MESSAGE' && payload.reportId) {
                    try {
                        const { DB } = await import('../utils/db.js');
                        const db = DB.public();
                        
                        // Specific query: anonymous_id + report_id + most recent
                        const existingPush = await db.query(`
                            SELECT push_sent_at 
                            FROM notifications 
                            WHERE anonymous_id = $1 
                              AND report_id = $2 
                              AND push_sent_at IS NOT NULL
                            ORDER BY created_at DESC 
                            LIMIT 1
                        `, [anonymousId, payload.reportId]);
                        
                        if (existingPush.rows.length > 0) {
                            // Push already sent, skip to prevent duplicate
                            if (process.env.DEBUG) {
                                console.log(`[Orchestrator][${traceId}] Skip push: already sent at ${existingPush.rows[0].push_sent_at}`);
                            }
                            await eventDeduplicator.markDispatched(jobData.id, 'skipped-duplicate');
                            return DispatchResult.SUCCESS;
                        }
                    } catch (err) {
                        // Fail-safe: if verification fails, send push anyway
                        if (process.env.DEBUG) {
                            console.warn(`[Orchestrator][${traceId}] push_sent_at check failed, proceeding with push:`, err.message);
                        }
                    }
                }

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
        const { type, target, payload } = jobData;

        // Resolve Subscriptions
        const { DB } = await import('../utils/db.js');
        const db = DB.public();

        const result = await db.query(
            'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE anonymous_id = $1 AND is_active = true',
            [target.anonymousId]
        );
        const subscriptions = result.rows;

        if (!subscriptions || subscriptions.length === 0) {
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
