import EventEmitter from 'events';
import redis, { redisSubscriber } from '../config/redis.js';
import crypto from 'crypto';

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
        console.log(`[RealtimeEvents] Instance created: ${this.instanceId}`);

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
                    console.log(`[Realtime] Subscribed to ${REALTIME_CHANNEL}. Count: ${count}`);
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
                            console.log(`[Realtime] 📥 Received from Redis: ${eventName} (ID: ${eventId}) from ${origin}`);
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
     * @param {string} event - Event name
     * @param {object} payload - Event data
     */
    broadcast(event, payload) {
        // 1. Emit locally immediately (Optimistic/Fast)
        super.emit(event, payload);

        // 2. Publish to Redis for other instances
        if (redis && redis.status === 'ready') {
            const message = JSON.stringify({
                eventId: crypto.randomUUID(),
                origin: this.instanceId,
                channel: event,
                payload: payload,
                timestamp: Date.now()
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
    emitNewComment(reportId, comment, originClientId) {
        this.broadcast(`comment:${reportId}`, { comment, originClientId });
        console.log(`[Realtime] Broadcasted new comment for report ${reportId}`);
    }

    /**
     * Emit a comment update event
     * @param {string} reportId
     * @param {object} comment
     * @param {string} [originClientId]
     */
    emitCommentUpdate(reportId, comment, originClientId) {
        this.broadcast(`comment-update:${reportId}`, { comment, originClientId });
        console.log(`[Realtime] Broadcasted comment update for report ${reportId}`);
    }

    /**
     * Emit a comment delete event
     * @param {string} reportId
     * @param {string} commentId
     * @param {string} [originClientId]
     */
    emitCommentDelete(reportId, commentId, originClientId) {
        this.broadcast(`comment-delete:${reportId}`, { commentId, originClientId });
        console.log(`[Realtime] Broadcasted comment delete for report ${reportId}`);
    }

    /**
     * Emit a new report event (Global Feed)
     * @param {object} report
     * @param {string} [originClientId]
     */
    emitNewReport(report, originClientId) {
        this.broadcast('global-report-update', {
            type: 'new-report',
            report: report,
            originClientId
        });
        console.log(`[Realtime] Broadcasted new report ${report.id} to global feed`);
    }

    /**
     * Emit a global report deletion event
     * @param {string} reportId
     * @param {string} category
     * @param {string} status
     * @param {string} [originClientId]
     */
    emitReportDelete(reportId, category, status, originClientId) {
        this.broadcast('global-report-update', {
            type: 'delete',
            reportId,
            category,
            status,
            originClientId
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
     * Emit a vote/like update
     * @param {string} type - 'report' or 'comment'
     * @param {string} id - The ID of the item being liked
     * @param {object} updates - The updates object
     * @param {string} [originClientId]
     * @param {string} [reportId] - ONLY for comments, to route correctly to report stream
     */
    emitVoteUpdate(type, id, updates, originClientId, reportId) {
        if (type === 'report') {
            this.broadcast(`report-update:${id}`, { ...updates, originClientId });
            this.broadcast('global-report-update', {
                type: 'stats-update',
                reportId: id,
                updates,
                originClientId
            });
        } else if (type === 'comment') {
            // DEPRECATED for likes, but kept for general updates:
            this.broadcast(`comment-update:${id}`, { ...updates, originClientId });

            // NEW Atomic Routing (if reportId provided):
            if (reportId) {
                this.broadcast(`comment-update:${reportId}`, {
                    id,
                    ...updates,
                    originClientId
                });
            }
        }
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
    emitStatusChange(reportId, prevStatus, newStatus, originClientId) {
        this.broadcast('global-report-update', {
            type: 'status-change',
            reportId,
            prevStatus,
            newStatus,
            originClientId
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
