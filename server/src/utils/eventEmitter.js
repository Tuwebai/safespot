import EventEmitter from 'events';
import redis, { redisSubscriber } from '../config/redis.js';
import crypto from 'crypto';
import { eventStore } from '../services/eventStore.js';
import { logError } from './logger.js';

const REALTIME_CHANNEL = 'SAFESPOT_REALTIME_BUS';

/**
 * Global Event Emitter for Real-time Updates
 * Enhanced with Redis Pub/Sub for Horizontal Scaling
 */
class RealtimeEvents extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(100); // Allow many concurrent SSE connections
        this.instanceId = Math.random().toString(36).substring(7);
        if (process.env.DEBUG) {
            console.log(`[RealtimeEvents] Instance created: ${this.instanceId}`);
        }

        // Initialize Redis Subscription
        this.initRedisSubscription();
    }

    /**
     * Subscribe to the global Redis channel to receive events from other instances
     */
    initRedisSubscription() {
        if (redisSubscriber) {
            redisSubscriber.subscribe(REALTIME_CHANNEL, (err, count) => {
                if (err) {
                    console.error('[Realtime] Failed to subscribe to Redis:', err);
                } else {
                    if (process.env.DEBUG) {
                        console.log(`[Realtime] Subscribed to ${REALTIME_CHANNEL}. Count: ${count}`);
                    }
                }
            });

            redisSubscriber.on('message', (channel, message) => {
                if (channel === REALTIME_CHANNEL) {
                    try {
                        const { eventId, origin, channel: eventName, payload, timestamp } = JSON.parse(message);

                        // Enterprise Contract:
                        // { eventId, origin, channel, payload, timestamp }

                        // Filter loopback (Own events are already emitted locally in broadcast)
                        if (origin !== this.instanceId) {
                            super.emit(eventName, payload);
                            if (process.env.DEBUG) {
                                console.log(`[Realtime] 📥 Received from Redis: ${eventName} (ID: ${eventId}) from ${origin}`);
                            }
                        } else {
                            // console.log(`[Realtime] 🔂 Ignored loopback: ${eventName} (ID: ${eventId})`);
                        }
                    } catch (err) {
                        console.error('[Realtime] Error parsing Redis message:', err);
                    }
                }
            });
        }
    }

    /**
     * Publish an event to the Cluster (Redis) and Emit Locally
     * Enhanced with Event Sourcing (M9/11)
     * @param {string} event - Event name
     * @param {object} payload - Event data
     * @param {object} [options] - { aggregateType, aggregateId }
     */
    async broadcast(event, payload, options = {}) {
        const eventId = payload?.eventId || crypto.randomUUID();
        const serverTimestamp = payload?.serverTimestamp || Date.now();
        let sequence_id = null;

        const enrichedPayload = (typeof payload === 'object' && payload !== null)
            ? { ...payload, eventId, serverTimestamp }
            : { payload, eventId, serverTimestamp };

        // [M9/11 GUARDRAIL] Event Sourcing Persistence
        // Only persist if aggregate data is provided (Whitelist logic)
        if (options.aggregateType && options.aggregateId) {
            try {
                sequence_id = await eventStore.append({
                    aggregate_type: options.aggregateType,
                    aggregate_id: options.aggregateId,
                    event_type: event.split(':')[0], // Extract base event name
                    payload: enrichedPayload,
                    metadata: {
                        origin: this.instanceId,
                        client_id: payload.originClientId
                    }
                });

                if (sequence_id) {
                    enrichedPayload.sequence_id = sequence_id;
                }
            } catch (err) {
                // If EventStore fails, we log it but don't break SSE if it's already a high-traffic system
                // However, per architecture Rule: Outbox-like atomicity
                // Decisions: we log FATAL and continue only if it's non-critical.
                console.error(`[Realtime] EventStore FAIL for ${event}:`, err);
            }
        }

        // 1. Emit locally immediately (Optimistic/Fast)
        super.emit(event, enrichedPayload);

        // 2. Publish to Redis for other instances
        if (redis && redis.status === 'ready') {
            const message = JSON.stringify({
                eventId,
                origin: this.instanceId,
                channel: event,
                payload: enrichedPayload,
                timestamp: serverTimestamp
            });

            redis.publish(REALTIME_CHANNEL, message).catch(err => {
                console.error(`[Realtime] Failed to publish ${event} to Redis:`, err);
            });
        }
    }

    /**
     * Emit a new comment event
     * @param {string} reportId
     * @param {object} comment
     * @param {string} [originClientId]
     */
    async emitNewComment(reportId, comment, originClientId) {
        await this.broadcast(`comment:${reportId}`, { comment, originClientId }, {
            aggregateType: 'report',
            aggregateId: reportId
        });
        // Silent broadcast
    }

    /**
     * Emit a comment update event
     * @param {string} reportId
     * @param {object} comment
     * @param {string} [originClientId]
     */
    async emitCommentUpdate(reportId, comment, originClientId) {
        await this.broadcast(`comment-update:${reportId}`, { comment, originClientId });
        console.log(`[Realtime] Broadcasted comment update for report ${reportId}`);
    }

    /**
     * Emit a comment delete event
     * @param {string} reportId
     * @param {string} commentId
     * @param {string} [originClientId]
     */
    async emitCommentDelete(reportId, commentId, originClientId, eventId) {
        await this.broadcast(`comment-delete:${reportId}`, { commentId, originClientId, eventId }, {
            aggregateType: 'report',
            aggregateId: reportId
        });
        console.log(`[Realtime] Broadcasted comment delete for report ${reportId} (ID: ${eventId || 'new'})`);
    }

    /**
     * Emit a new report event (Global Feed)
     * @param {object} report
     * @param {string} [originClientId]
     */
    async emitNewReport(report, originClientId) {
        await this.broadcast('global-report-update', {
            type: 'new-report',
            report: report,
            originClientId
        }, {
            aggregateType: 'report',
            aggregateId: report.id
        });
        // Silent broadcast
    }

    /**
     * Emit a global report deletion event
     * @param {string} reportId
     * @param {string} category
     * @param {string} status
     * @param {string} [originClientId]
     */
    async emitReportDelete(reportId, category, status, originClientId) {
        await this.broadcast('global-report-update', {
            type: 'delete',
            reportId,
            category,
            status,
            originClientId
        }, {
            aggregateType: 'report',
            aggregateId: reportId
        });
        console.log(`[Realtime] Broadcasted report delete ${reportId}`);
    }

    /**
     * Emit a chat message
     * @param {string} roomId
     * @param {object} message
     * @param {string} originClientId
     */
    emitChatMessage(roomId, message, originClientId) {
        // Broad message for all participants
        this.broadcast(`chat:${roomId}`, { message, originClientId });
        console.log(`[Realtime] Broadcasted chat message for room ${roomId}`);
    }

    /**
     * Emit a chat status update (read/delivered/typing)
     * @param {string} type - 'read', 'delivered', 'typing'
     * @param {string} roomId
     * @param {object} payload
     */
    emitChatStatus(type, roomId, payload) {
        this.broadcast(`chat-${type}:${roomId}`, payload);
    }

    /**
     * Emit a targeted chat update for a specific user
     * @param {string} userId
     * @param {object} payload
     */
    emitUserChatUpdate(userId, payload) {
        this.broadcast(`user-chat-update:${userId}`, payload);
    }

    /**
     * Emit a granular message delivery confirmation
     * @param {string} userId - Sender of the message (who will receive the ACK)
     * @param {object} payload - { messageId, conversationId, deliveredAt, traceId }
     */
    emitMessageDelivered(userId, payload) {
        console.log(`[RealtimeEvents] 📬 Emitting message.delivered to ${userId?.substring(0, 8)}...`, payload);
        this.broadcast(`user-message-delivered:${userId}`, payload);
    }

    /**
     * Emit a granular message read confirmation
     * @param {string} userId - Sender of the message (who will receive the ACK)
     * @param {object} payload - { roomId, readerId }
     */
    emitMessageRead(userId, payload) {
        this.broadcast(`user-message-read:${userId}`, payload);
    }

    /**
     * Emit a vote/like update (SSOT Refinement Feb 2026)
     * @param {string} type - 'report' or 'comment'
     * @param {string} id - The ID of the item being liked
     * @param {object} updates - The updates object (likes_count/upvotes_count)
     * @param {string} [originClientId]
     * @param {string} [reportId] - ONLY for comments, to route correctly to report stream
     */
    async emitVoteUpdate(type, id, updates, originClientId, reportId) {
        const eventId = updates.eventId; // Pass through if exists
        if (type === 'report') {
            // 1. Target Broadcast (for detail views)
            await this.broadcast(`report-update:${id}`, { ...updates, originClientId }, {
                aggregateType: 'report',
                aggregateId: id
            });
            // 2. Global Stream (for feeds)
            await this.broadcast('global-report-update', {
                type: 'stats-update',
                reportId: id,
                updates,
                originClientId
            }, {
                aggregateType: 'report',
                aggregateId: id
            });
        } else if (type === 'comment') {
            // Target Broadcast (for comment lists)
            await this.broadcast(`comment-update:${id}`, { ...updates, originClientId });

            // Atomic Routing (if reportId provided to sync parent report feed)
            if (reportId) {
                await this.broadcast(`comment-update:${reportId}`, {
                    id,
                    ...updates,
                    originClientId
                }, {
                    aggregateType: 'report',
                    aggregateId: reportId
                });
            }
        }
    }

    /**
     * emitLikeUpdate (Semantic alias for emitVoteUpdate)
     * Specifically for reports to maintain API consistency in routers
     */
    emitLikeUpdate(reportId, upvotesCount, category, status, originClientId) {
        this.emitVoteUpdate('report', reportId, {
            upvotes_count: upvotesCount,
            category,
            status
        }, originClientId);
    }

    /**
     * Emit a comment like/unlike (Atomic Delta)
     * @param {string} reportId
     * @param {string} commentId
     * @param {number} delta - +1 or -1
     * @param {string} originClientId
     */
    emitCommentLike(reportId, commentId, delta, originClientId) {
        this.broadcast(`comment-update:${reportId}`, {
            id: commentId,
            delta,
            isLikeDelta: true,
            originClientId
        });

        // Also broadcast to comment-specific channel for any direct listeners
        this.broadcast(`comment-update:${commentId}`, {
            id: commentId,
            delta,
            isLikeDelta: true,
            originClientId
        });
    }

    /**
     * Emit a badge earned event
     * @param {string} anonymousId
     * @param {object} notification
     */
    emitBadgeEarned(anonymousId, notification) {
        this.broadcast(`user-notification:${anonymousId}`, {
            type: 'achievement',
            notification
        });
        console.log(`[Realtime] Broadcasted badge earned for ${anonymousId}`);
    }

    /**
     * Emit a new user creation event
     * @param {string} anonymousId
     */
    emitNewUser(anonymousId) {
        this.broadcast('global-report-update', {
            type: 'new-user',
            anonymousId
        });
        console.log(`[Realtime] Broadcasted new user creation: ${anonymousId}`);
    }

    /**
     * Emit a report status change
     * @param {string} reportId
     * @param {string} prevStatus
     * @param {string} newStatus
     * @param {string} [originClientId]
     */
    async emitStatusChange(reportId, prevStatus, newStatus, originClientId) {
        await this.broadcast('global-report-update', {
            type: 'status-change',
            reportId,
            prevStatus,
            newStatus,
            originClientId
        }, {
            aggregateType: 'report',
            aggregateId: reportId
        });
        console.log(`[Realtime] Broadcasted status change for ${reportId}`);
    }

    /**
     * Emit a user ban/unban event
     * @param {string} anonymousId
     * @param {object} payload - { status, reason }
     */
    emitUserBan(anonymousId, payload) {
        this.broadcast(`user-status:${anonymousId}`, payload);
        console.log(`[Realtime] Broadcasted ban event for ${anonymousId}`);
    }

    /**
     * Emit a user-specific notification
     * @param {string} anonymousId
     * @param {object} payload - { type, notification, ... }
     */
    emitUserNotification(anonymousId, payload) {
        this.broadcast(`user-notification:${anonymousId}`, payload);
        console.log(`[Realtime] Broadcasted notification for user ${anonymousId}`);
    }

    /**
     * Emit a generic report update
     * @param {object} report
     * @param {string} [originClientId]
     */
    async emitReportUpdate(report, originClientId) {
        await this.broadcast(`report-update:${report.id}`, {
            report,
            originClientId
        }, {
            aggregateType: 'report',
            aggregateId: report.id
        });
        console.log(`[Realtime] Broadcasted report update for ${report.id}`);
    }

    /**
     * Emit a general global update
     * @param {string} type
     * @param {object} payload
     */
    emitGlobalUpdate(type, payload) {
        this.broadcast('global-report-update', {
            ...payload,
            type
        });
    }
}

// Export singleton instance
export const realtimeEvents = new RealtimeEvents();
