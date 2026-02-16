import { realtimeEvents } from '../utils/eventEmitter.js';
import { presenceTracker } from '../utils/presenceTracker.js';
// webpush is imported by webPush.js utilities
import { sendPushNotification, createChatNotificationPayload, createActivityNotificationPayload } from '../utils/webPush.js';
import { eventDeduplicator } from './DeliveryLedger.js';
import { DispatchResult } from './NotificationDispatcher.js';
import { logError } from '../utils/logger.js';
import logger from '../utils/logger.js';

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
        const { traceId, type, target, payload, delivery: _delivery } = jobData;
        const anonymousId = target.anonymousId;

        if (!anonymousId) {
            return DispatchResult.PERMANENT_ERROR;
        }

        try {
            // 1. Check Presence (Single Source of Truth: Redis)
            const isOnline = await presenceTracker.isOnline(anonymousId);
            // const _isPriorityHigh = _delivery?.priority === 'high'; // Reserved
            const isSecurity = type === 'SECURITY_ALERT';

            // 2. Decision Logic
            // SECURITY -> ALWAYS PUSH (Safety First)
            if (isSecurity) {
                if (process.env.DEBUG) {
                    // eslint-disable-next-line no-console
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
                // 🏛️ FASE 3: ATOMIC PUSH DEDUPLICATION
                // Pattern: Reserve -> Send -> Confirm
                // Eliminates race conditions by using DB as coordinator
                
                // Only for activity notifications (not chat messages)
                if (type !== 'CHAT_MESSAGE' && payload.reportId) {
                    try {
                        const { DB } = await import('../utils/db.js');
                        const db = DB.public();
                        
                        // 1. ATOMIC REQUEST: Try to reserve this notification for pushing
                        // Returns ID only if we won the race
                        const reservation = await db.query(`
                            UPDATE notifications
                            SET push_attempt_at = NOW(),
                                push_attempt_count = push_attempt_count + 1
                            WHERE anonymous_id = $1 
                              AND report_id = $2
                              AND push_sent_at IS NULL
                              AND (push_attempt_at IS NULL OR push_attempt_at < NOW() - INTERVAL '5 minutes')
                            RETURNING id
                        `, [anonymousId, payload.reportId]);
                        
                        // 2. CHECK RESULT
                        if (reservation.rows.length === 0) {
                            // We lost the race (already sent or reserved by another worker)
                            if (process.env.DEBUG) {
                                // eslint-disable-next-line no-console
                                console.log(`[Orchestrator][${traceId}] Skip push: atomic reservation failed (duplicate/locked)`);
                            }
                            await eventDeduplicator.markDispatched(jobData.id, 'skipped-duplicate-atomic');
                            return DispatchResult.SUCCESS;
                        }

                        // We won the lock! Proceed to send.
                    } catch (err) {
                        // Fail-safe: if DB fails, log and MAYBE proceed depending on policy
                        // For safety, we skip push on DB error to avoid massive blast
                        logError(err, { context: 'AtomicPushReservation', traceId });
                        return DispatchResult.RETRYABLE_ERROR;
                    }
                }

                // Routing decision - only log in debug
                await eventDeduplicator.markDispatched(jobData.id, 'push');
                
                // 3. SEND PUSH
                const pushResult = await this._dispatchPush(jobData);
                
                // 4. CONFIRM SUCCESS (Mark as permanently sent)
                if (pushResult === DispatchResult.SUCCESS && type !== 'CHAT_MESSAGE' && payload.reportId) {
                     try {
                        const { DB } = await import('../utils/db.js');
                        const db = DB.public();
                        
                        await db.query(`
                            UPDATE notifications 
                            SET push_sent_at = NOW() 
                            WHERE anonymous_id = $1 AND report_id = $2
                        `, [target.anonymousId, payload.reportId]);
                     } catch(err) {
                         // Silent fail - tracking is best effort
                         if (process.env.DEBUG) {
                            console.warn(`[Orchestrator] Failed to mark push_sent_at: ${err.message}`);
                         }
                     }
                }

                return pushResult;
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
            const conversationId = payload.data?.conversationId || payload.data?.roomId;

            // ✅ ENTERPRISE CONTRACT: Send the full message object for frontend processing
            realtimeEvents.emitUserChatUpdate(target.anonymousId, {
                eventId: jobData.id,
                serverTimestamp,
                conversationId,
                roomId: conversationId, // Backward compatibility temporal
                message: {
                    id: payload.entityId, // The real message ID from DB
                    conversation_id: conversationId,
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

        // 🔗 ENTERPRISE FINAL CATCH-ALL
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
        const pushStartedAt = Date.now();

        // Resolve Subscriptions
        // We implement the DB query here to decouple.
        const { DB } = await import('../utils/db.js');
        const db = DB.public();

        const result = await db.query(
            'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE anonymous_id = $1 AND is_active = true',
            [target.anonymousId]
        );
        const subscriptions = result.rows;

        if (!subscriptions || subscriptions.length === 0) {
            logger.info('CHAT_PIPELINE', {
                stage: 'PUSH_PROVIDER_OK',
                result: 'skipped_no_subscription',
                traceId: jobData.traceId,
                eventId: jobData.id,
                targetId: target.anonymousId,
                notificationType: type,
                durationMs: Date.now() - pushStartedAt
            });
            // No push sub -> Delivery 'succeeded' (nothing to do)
            return DispatchResult.SUCCESS;
        }

        // Prepare Payload
        let pushPayload;
        if (type === 'CHAT_MESSAGE') {
            const conversationId = payload.data?.conversationId || payload.data?.roomId;
            pushPayload = createChatNotificationPayload({
                id: payload.entityId,
                conversation_id: conversationId,
                room_id: conversationId, // Backward compatibility temporal
                senderAlias: payload.data?.senderAlias,
                content: payload.message,
                recipientAnonymousId: target.anonymousId
            }, { report_title: payload.data?.reportTitle });
        } else {
            pushPayload = createActivityNotificationPayload({
                type: (payload.data?.type || type).toLowerCase(),
                title: payload.title,
                message: payload.message,
                reportId: payload.reportId,
                entityId: payload.entityId,
                eventId: jobData.id,
                deepLink: payload.data?.deepLink
            });
        }

        // Send
        const results = await Promise.allSettled(subscriptions.map(sub =>
            sendPushNotification({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, pushPayload)
        ));

        const fulfilled = results.filter(r => r.status === 'fulfilled');
        const sentOk = fulfilled.filter(r => r.value?.success).length;
        const sentFail = fulfilled.filter(r => !r.value?.success).length + results.filter(r => r.status === 'rejected').length;

        logger.info('CHAT_PIPELINE', {
            stage: sentFail === 0 ? 'PUSH_PROVIDER_OK' : 'PUSH_PROVIDER_FAIL',
            result: sentFail === 0 ? 'ok' : 'partial_or_fail',
            traceId: jobData.traceId,
            eventId: jobData.id,
            targetId: target.anonymousId,
            notificationType: type,
            subscriptionCount: subscriptions.length,
            successCount: sentOk,
            failureCount: sentFail,
            durationMs: Date.now() - pushStartedAt
        });

        // Note: We track push_sent_at in routeAndDispatch now (Atomic Flow), 
        // so we don't strictly need to do it here, but keeping it for other flows might be safe.
        // However, to avoid double-update logic, we let routeAndDispatch handle the atomic confirmation.
        // Or if this method handles non-atomic flows?
        // Let's stick to routeAndDispatch handling the DB update for Atomic flows.

        // Basic classification
        const allRetryable = results.every(r => r.status === 'rejected');
        return allRetryable ? DispatchResult.RETRYABLE_ERROR : DispatchResult.SUCCESS;
    }
};
