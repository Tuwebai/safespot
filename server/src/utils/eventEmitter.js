import EventEmitter from 'events';
import redis, { redisSubscriber } from '../config/redis.js';
import crypto from 'crypto';
import { eventStore } from '../services/eventStore.js';
import { logError } from './logger.js';
import logger from './logger.js';

const REALTIME_CHANNEL = 'SAFESPOT_REALTIME_BUS';

function normalizeConversationId(payload = {}, fallback = null) {
    return payload.conversationId || payload.roomId || payload.message?.conversation_id || fallback || null;
}

function deterministicEventId(prefix, keyParts = {}) {
    const normalized = Object.keys(keyParts)
        .sort()
        .reduce((acc, key) => {
            const value = keyParts[key];
            acc[key] = value === undefined || value === null ? '' : String(value);
            return acc;
        }, {});

    const hash = crypto
        .createHash('sha1')
        .update(`${prefix}:${JSON.stringify(normalized)}`)
        .digest('hex')
        .slice(0, 16);

    return `${prefix}:${hash}`;
}

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
                                console.log(`[Realtime] ðŸ“¥ Received from Redis: ${eventName} (ID: ${eventId}) from ${origin}`);
                            }
                        } else {
                            // console.log(`[Realtime] ðŸ”‚ Ignored loopback: ${eventName} (ID: ${eventId})`);
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
        const conversationId = normalizeConversationId({ message }, roomId);
        const eventId = message?.eventId || deterministicEventId('chat-message', {
            conversationId,
            messageId: message?.id,
            senderId: message?.sender_id,
            createdAt: message?.created_at
        });

        this.broadcast(`chat:${roomId}`, {
            eventId,
            serverTimestamp: message?.created_at ? new Date(message.created_at).getTime() : Date.now(),
            conversationId,
            roomId: conversationId,
            message,
            originClientId: originClientId || 'backend'
        });

        logger.info('CHAT_PIPELINE', {
            stage: 'EVENT_EMIT',
            result: 'ok',
            eventId,
            conversationId,
            messageId: message?.id || null,
            originClientId: originClientId || 'backend',
            channel: `chat:${roomId}`
        });
    }

    /**
     * Emit a chat status update (read/delivered/typing)
     * @param {string} type - 'read', 'delivered', 'typing'
     * @param {string} roomId
     * @param {object} payload
     */
    emitChatStatus(type, roomId, payload) {
        const conversationId = normalizeConversationId(payload, roomId);
        const eventId = payload?.eventId || deterministicEventId(`chat-${type}`, {
            conversationId,
            messageId: payload?.messageId,
            senderId: payload?.senderId,
            readerId: payload?.readerId,
            receiverId: payload?.receiverId,
            status: payload?.status,
            isTyping: payload?.isTyping,
            action: payload?.action
        });

        this.broadcast(`chat-${type}:${roomId}`, {
            ...payload,
            eventId,
            serverTimestamp: payload?.serverTimestamp || Date.now(),
            originClientId: payload?.originClientId || 'backend',
            conversationId,
            roomId: conversationId,
            type: payload?.type || `chat.${type}`
        });
    }

    /**
     * Emit a targeted chat update for a specific user
     * @param {string} userId
     * @param {object} payload - { eventId, type, message, ... }
     * 
     * ðŸ”´ ENTERPRISE GUARD: eventId ES OBLIGATORIO y debe ser determinÃ­stico.
     * - Para mensajes persistidos: usar message.id de la DB
     * - Para eventos de control (typing, etc.): usar formato `action-conversationId-userId-timestamp`
     */
    emitUserChatUpdate(userId, payload) {
        const conversationId = normalizeConversationId(payload);
        const eventId = payload?.eventId || deterministicEventId('user-chat-update', {
            userId,
            conversationId,
            action: payload?.action || payload?.type || '',
            messageId: payload?.message?.id || payload?.messageId || payload?.id || ''
        });

        // Enrich with eventId and serverTimestamp for SSE contract
        const enrichedPayload = {
            ...payload,
            eventId,
            conversationId,
            roomId: payload?.roomId || conversationId,
            serverTimestamp: payload?.serverTimestamp || Date.now(),
            originClientId: payload?.originClientId || 'backend'
        };
        
        this.broadcast(`user-chat-update:${userId}`, enrichedPayload);
    }

    /**
     * Emit a granular message delivery confirmation
     * @param {string} userId - Sender of the message (who will receive the ACK)
     * @param {object} payload - { messageId, conversationId, deliveredAt, traceId }
     */
    emitMessageDelivered(userId, payload) {
        const conversationId = normalizeConversationId(payload);
        const eventId = payload?.eventId || deterministicEventId('message-delivered', {
            userId,
            conversationId,
            messageId: payload?.messageId || payload?.id || '',
            receiverId: payload?.receiverId || ''
        });

        const enrichedPayload = {
            ...payload,
            eventId,
            conversationId,
            roomId: payload?.roomId || conversationId,
            serverTimestamp: payload?.serverTimestamp || payload?.deliveredAt || Date.now(),
            originClientId: payload?.originClientId || 'backend',
            type: 'message.delivered'
        };
        this.broadcast(`user-message-delivered:${userId}`, enrichedPayload);
    }

    /**
     * Emit a granular message read confirmation
     * @param {string} userId - Sender of the message (who will receive the ACK)
     * @param {object} payload - { roomId, readerId }
     */
    emitMessageRead(userId, payload) {
        const conversationId = payload.conversationId || payload.roomId || null;
        const eventId = payload?.eventId || deterministicEventId('message-read', {
            userId,
            conversationId,
            messageId: payload?.messageId || payload?.id || '',
            readerId: payload?.readerId || ''
        });
        const enrichedPayload = {
            ...payload,
            conversationId,
            roomId: payload.roomId || conversationId,
            eventId,
            serverTimestamp: payload?.serverTimestamp || Date.now(),
            originClientId: payload?.originClientId || 'backend',
            type: 'message.read'
        };
        this.broadcast(`user-message-read:${userId}`, enrichedPayload);
    }

    /**
     * Emit a vote/like update (SSOT Refinement Feb 2026)
     * @param {string} type - 'report' or 'comment'
     * @param {string} id - The ID of the item being liked
     * @param {object} updates - The updates object (upvotes_count, status, etc.)
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
    }

    /**
     * Emit a user ban/unban event
     * @param {string} anonymousId
     * @param {object} payload - { status, reason }
     */
    emitUserBan(anonymousId, payload) {
        this.broadcast(`user-status:${anonymousId}`, payload);
    }

    /**
     * Emit a user-specific notification
     * @param {string} anonymousId
     * @param {object} payload - { eventId, type, notification, ... }
     * 
     * ðŸ”´ ENTERPRISE GUARD: eventId ES OBLIGATORIO y debe ser determinÃ­stico (DB ID).
     * NUNCA usar crypto.randomUUID() aquÃ­. El eventId debe venir de la entidad persistida.
     */
    emitUserNotification(anonymousId, payload) {
        if (!payload?.eventId) {
            throw new Error(`[EnterpriseGuard] emitUserNotification requires deterministic eventId from database. Received: ${JSON.stringify(payload)}`);
        }
        
        // Enrich with eventId if not present at root level (for SSE contract)
        const enrichedPayload = {
            ...payload,
            eventId: payload.eventId,
            serverTimestamp: payload.serverTimestamp || Date.now()
        };
        
        this.broadcast(`user-notification:${anonymousId}`, enrichedPayload);
    }

    /**
     * Emit a generic report update
     * @param {object} report
     * @param {string} [originClientId]
     */
    async emitReportUpdate(report, originClientId) {
        const eventPayload = {
            report,
            originClientId
        };
        await this.broadcast(`report-update:${report.id}`, eventPayload, {
            aggregateType: 'report',
            aggregateId: report.id
        });
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

