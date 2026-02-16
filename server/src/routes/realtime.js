import express from 'express';
import { realtimeEvents } from '../utils/eventEmitter.js';
import { SSEResponse } from '../utils/sseResponse.js';
import { presenceTracker } from '../utils/presenceTracker.js';
import pool from '../config/database.js';
import logger from '../utils/logger.js';


import redis, { redisSubscriber } from '../config/redis.js';
import { eventDeduplicator } from '../engine/DeliveryLedger.js';
import { verifyMembership } from '../middleware/requireRoomMembership.js';
import { AppError, ValidationError } from '../utils/AppError.js';
import { attachOpsRequestTelemetry, logRealtimeAuthzDenied, logRealtimeCatchup } from '../utils/opsTelemetry.js';

const router = express.Router();
router.use(attachOpsRequestTelemetry('realtime'));

function getAuthenticatedAnonymousId(req) {
    return req.user?.anonymous_id || null;
}

function hasAdminRole(req) {
    return req.user?.role === 'admin' || req.user?.role === 'super_admin';
}

function logRealtimeForbidden(req, target, reason, statusCode) {
    logger.warn('REALTIME_FORBIDDEN', {
        actor: req.user?.anonymous_id || null,
        target,
        reason,
        requestId: req.id || req.headers['x-request-id'] || null
    });
    logRealtimeAuthzDenied(req, {
        endpoint: req.originalUrl || req.url,
        reason,
        statusCode
    });
}

/**
 * POST /api/realtime/ack/:eventId
 * Acknowledge receipt of an EVENT (technical deduplication)
 * ⚠️ This is NOT message delivery - that's handled by /chats/messages/:id/ack-delivered
 */
router.post('/ack/:eventId', async (req, res, next) => {
    const { eventId } = req.params;
    try {
        // 🏛️ SSOT: This marks the EVENT as processed (deduplication)
        // Message delivered status is in PostgreSQL, not here
        await eventDeduplicator.markProcessed(eventId);
        res.json({ success: true, eventId });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/realtime/catchup
 * 🚑 Gap Catchup API for Realtime Orchestrator
 * Returns missed domain events since a given serverTimestamp
 */
router.get('/catchup', async (req, res, next) => {
    const catchupStart = Date.now();
    const { since } = req.query;
    if (!since) {
        logRealtimeCatchup(req, { statusCode: 400, durationMs: Date.now() - catchupStart, eventCount: 0 });
        return next(new ValidationError('Missing since timestamp'));
    }

    try {
        const sinceTs = parseInt(since, 10);
        if (!Number.isFinite(sinceTs) || sinceTs < 0) {
            logRealtimeCatchup(req, { statusCode: 400, durationMs: Date.now() - catchupStart, eventCount: 0 });
            return next(new ValidationError('Invalid since timestamp'));
        }

        // Security: Catchup is authenticated-only to prevent unauthorized replay.
        const anonymousId = getAuthenticatedAnonymousId(req);
        if (!anonymousId) {
            logRealtimeForbidden(req, 'catchup', 'AUTH_REQUIRED', 401);
            logRealtimeCatchup(req, { statusCode: 401, durationMs: Date.now() - catchupStart, eventCount: 0 });
            return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED', true));
        }
        
        // 1. Fetch missed Chat Messages (ONLY from user's conversations)
        // 🏛️ SECURITY FIX: Filter by conversation membership
        const messageTask = pool.query(
            `SELECT m.* FROM chat_messages m
             INNER JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
             WHERE cm.user_id = $2
               AND (EXTRACT(EPOCH FROM m.created_at) * 1000 > $1)
             ORDER BY m.created_at ASC LIMIT 50`,
            [sinceTs, anonymousId]
        );
        const userRole = req.user?.role || 'citizen';

        // 1b. Fetch Delivery ACKs for messages that became delivered AFTER since
        // 🏛️ ENTERPRISE FIX: Include delivery status updates for background sync
        const deliveryTask = pool.query(
            `SELECT m.id, m.sender_id, m.conversation_id, m.is_delivered, m.is_read, 
                    m.delivered_at, m.read_at
             FROM chat_messages m
             WHERE m.sender_id = $2 
               AND m.is_delivered = true
               AND (EXTRACT(EPOCH FROM m.delivered_at) * 1000 > $1)
             ORDER BY m.delivered_at ASC LIMIT 50`,
            [sinceTs, anonymousId]
        );

        const reportTask = pool.query(
            `SELECT 
                r.id, r.anonymous_id, r.title, r.description, r.category, r.zone, r.address, 
                r.latitude, r.longitude, r.status, r.upvotes_count, r.comments_count, 
                r.created_at, r.updated_at, r.last_edited_at, r.incident_date, r.image_urls, r.is_hidden, r.deleted_at,
                u.alias, u.avatar_url 
             FROM reports r
             LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
             WHERE (GREATEST(EXTRACT(EPOCH FROM r.created_at), EXTRACT(EPOCH FROM r.updated_at)) * 1000 > $1)
               AND (r.deleted_at IS NULL OR r.anonymous_id = $2 OR $3 = 'admin')
               AND (r.is_hidden = false OR r.anonymous_id = $2 OR $3 = 'admin')
             ORDER BY GREATEST(r.created_at, r.updated_at) ASC LIMIT 50`,
            [sinceTs, anonymousId, userRole]
        );

        // 3. Fetch missed Comment deletions
        const commentTask = pool.query(
            `SELECT c.id, c.report_id, c.deleted_at FROM comments c
             INNER JOIN reports r ON r.id = c.report_id
             WHERE (EXTRACT(EPOCH FROM c.deleted_at) * 1000 > $1)
               AND (r.deleted_at IS NULL OR r.anonymous_id = $2 OR $3 = 'admin')
               AND (r.is_hidden = false OR r.anonymous_id = $2 OR $3 = 'admin')
             ORDER BY c.deleted_at ASC LIMIT 50`,
            [sinceTs, anonymousId, userRole]
        );

        const [messagesResult, reportsResult, commentsResult, deliveryResult] = await Promise.all([messageTask, reportTask, commentTask, deliveryTask]);

        const events = [];

        // Process Delivery ACKs (for background sync when app was closed)
        // 🏛️ ENTERPRISE FIX: Sync delivery/read status for messages sent by this user
        deliveryResult.rows.forEach(m => {
            const deliveredAtTs = new Date(m.delivered_at).getTime();
            
            // Emit message.delivered event
            events.push({
                eventId: `ack_${m.id}_${deliveredAtTs}`,
                serverTimestamp: deliveredAtTs,
                type: 'message.delivered',
                payload: {
                    id: m.id,
                    messageId: m.id,
                    conversationId: m.conversation_id,
                    deliveredAt: m.delivered_at,
                    isDelivered: m.is_delivered,
                    isRead: m.is_read,
                    originClientId: 'system_catchup'
                },
                isReplay: true
            });

            // Also emit message.read if already read
            if (m.is_read && m.read_at) {
                const readAtTs = new Date(m.read_at).getTime();
                events.push({
                    eventId: `read_${m.id}_${readAtTs}`,
                    serverTimestamp: readAtTs,
                    type: 'message.read',
                    payload: {
                        id: m.id,
                        messageId: m.id,
                        conversationId: m.conversation_id,
                        readAt: m.read_at,
                        isRead: true,
                        originClientId: 'system_catchup'
                    },
                    isReplay: true
                });
            }
        });

        // Process Reports
        reportsResult.rows.forEach(r => {
            const createdAtTs = new Date(r.created_at).getTime();
            const updatedAtTs = r.updated_at ? new Date(r.updated_at).getTime() : 0;
            const ts = Math.max(createdAtTs, updatedAtTs);

            // A. New Report
            if (createdAtTs > sinceTs) {
                events.push({
                    eventId: `rep_${r.id}`,
                    serverTimestamp: ts,
                    type: 'report-create',
                    payload: {
                        id: r.id,
                        partial: {
                            id: r.id,
                            anonymous_id: r.anonymous_id,
                            title: r.title,
                            description: r.description,
                            category: r.category,
                            zone: r.zone,
                            address: r.address,
                            latitude: r.latitude,
                            longitude: r.longitude,
                            status: r.status,
                            upvotes_count: r.upvotes_count,
                            comments_count: r.comments_count,
                            created_at: r.created_at,
                            updated_at: r.updated_at,
                            last_edited_at: r.last_edited_at,
                            incident_date: r.incident_date,
                            image_urls: r.image_urls,
                            is_hidden: r.is_hidden,
                            deleted_at: r.deleted_at,
                            author: {
                                id: r.anonymous_id,
                                alias: r.alias,
                                avatarUrl: r.avatar_url
                            }
                        },
                        originClientId: 'system_catchup'
                    },
                    isReplay: true
                });
            }
            // B. Updated Report (but not new)
            else if (updatedAtTs > sinceTs) {
                events.push({
                    eventId: `upd_${r.id}_${updatedAtTs}`,
                    serverTimestamp: ts,
                    type: 'report-update',
                    payload: {
                        id: r.id,
                        partial: {
                            id: r.id,
                            anonymous_id: r.anonymous_id,
                            title: r.title,
                            description: r.description,
                            category: r.category,
                            zone: r.zone,
                            address: r.address,
                            latitude: r.latitude,
                            longitude: r.longitude,
                            status: r.status,
                            upvotes_count: r.upvotes_count,
                            comments_count: r.comments_count,
                            created_at: r.created_at,
                            updated_at: r.updated_at,
                            last_edited_at: r.last_edited_at,
                            incident_date: r.incident_date,
                            image_urls: r.image_urls,
                            is_hidden: r.is_hidden,
                            deleted_at: r.deleted_at
                        }, // Full safe state for reconciliation
                        originClientId: 'system_catchup'
                    },
                    isReplay: true
                });
            }
        });

        // Process Messages
        messagesResult.rows.forEach(m => {
            const createdAtTs = new Date(m.created_at).getTime();
            const deliveredAtTs = m.delivered_at ? new Date(m.delivered_at).getTime() : 0;

            // A. If it's a NEW message
            if (createdAtTs > sinceTs) {
                events.push({
                    eventId: `msg_${m.id}`,
                    serverTimestamp: createdAtTs,
                    type: 'new-message',
                    payload: {
                        message: {
                            id: m.id,
                            conversation_id: m.conversation_id,
                            sender_id: m.sender_id,
                            content: m.content,
                            type: m.type,
                            created_at: m.created_at,
                            is_read: m.is_read,
                            is_delivered: m.is_delivered
                        },
                        originClientId: 'system_catchup'
                    },
                    isReplay: true
                });
            }

            // B. If it's an OLD message that was DELIVERED after 'since'
            if (deliveredAtTs > sinceTs) {
                events.push({
                    eventId: `ack_${m.id}_${deliveredAtTs}`,
                    serverTimestamp: deliveredAtTs,
                    type: 'message.delivered',
                    payload: {
                        messageId: m.id,
                        id: m.id,
                        conversationId: m.conversation_id,
                        deliveredAt: m.delivered_at,
                        originClientId: 'system_catchup'
                    },
                    isReplay: true
                });
            }
        });

        // Process Comment Deletions
        commentsResult.rows.forEach(c => {
            const ts = new Date(c.deleted_at || Date.now()).getTime();
            events.push({
                eventId: `cde_${c.id}_${ts}`,
                serverTimestamp: ts,
                type: 'comment-delete',
                payload: {
                    id: c.id,
                    reportId: c.report_id,
                    originClientId: 'system_catchup'
                },
                isReplay: true
            });
        });

        // Deduplicate by eventId to avoid replaying the same semantic event twice
        // when multiple catchup sources include the same transition.
        const seenEventIds = new Set();
        const dedupedEvents = [];
        for (const event of events) {
            const dedupeKey = event?.eventId || `${event?.type}:${event?.serverTimestamp || 0}`;
            if (seenEventIds.has(dedupeKey)) continue;
            seenEventIds.add(dedupeKey);
            dedupedEvents.push(event);
        }

        logRealtimeCatchup(req, { statusCode: 200, durationMs: Date.now() - catchupStart, eventCount: dedupedEvents.length });
        res.json(dedupedEvents);
    } catch (err) {
        console.error('[Catchup] Error:', err);
        logRealtimeCatchup(req, { statusCode: 500, durationMs: Date.now() - catchupStart, eventCount: 0 });
        next(new AppError('Catchup failed', 500));
    }
});

/**
 * GET /api/realtime/status/:eventId
 * Check processing status of an event (technical deduplication)
 * ⚠️ DEPRECATED: For message delivery status use /message-status/:messageId (PostgreSQL SSOT)
 */
router.get('/status/:eventId', async (req, res, next) => {
    const { eventId } = req.params;
    try {
        const status = await eventDeduplicator.getStatus(eventId);
        res.json(status || { status: 'not_found' });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/realtime/message-status/:messageId
 * 🏛️ SSOT: Check message delivery status from PostgreSQL (NOT Redis)
 * 
 * This is the AUTHORITATIVE source for delivered/read state.
 * SW uses this for Push suppression instead of Redis.
 */
router.get('/message-status/:messageId', async (req, res, next) => {
    const { messageId } = req.params;
    try {
        const anonymousId = getAuthenticatedAnonymousId(req);
        if (!anonymousId) {
            logRealtimeForbidden(req, messageId, 'AUTH_REQUIRED', 401);
            return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED', true));
        }

        const result = await pool.query(
            `SELECT m.is_delivered, m.is_read
             FROM chat_messages m
             LEFT JOIN conversation_members cm
               ON cm.conversation_id = m.conversation_id
              AND cm.user_id = $2
             WHERE m.id = $1
               AND (m.sender_id = $2 OR cm.user_id IS NOT NULL)
             LIMIT 1`,
            [messageId, anonymousId]
        );

        if (result.rows.length === 0) {
            // Unauthorized or not found -> fail-open for push suppression, without leaking status.
            return res.json({ delivered: false, read: false });
        }

        res.json({
            delivered: result.rows[0].is_delivered || false,
            read: result.rows[0].is_read || false
        });
    } catch (err) {
        console.error('[SSOT] Error fetching message status:', err);
        return next(new AppError('Message status check failed', 500, 'MESSAGE_STATUS_FAILED', false));
    }
});

/**
 * GET /api/realtime/status
 * Health check for the real-time infrastructure (Redis + SSE Tracker)
 */
router.get('/status', async (req, res, next) => {
    try {
        const redisStatus = redis ? redis.status : 'disabled';
        const subStatus = redisSubscriber ? redisSubscriber.status : 'disabled';

        // Quick DB check
        const dbStart = Date.now();
        await pool.query('SELECT 1');
        const dbLatency = Date.now() - dbStart;

        res.json({
            success: true,
            status: (redisStatus === 'ready' || redisStatus === 'connect') ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            infrastructure: {
                redis: redisStatus,
                redis_subscriber: subStatus,
                database: 'ok',
                db_latency_ms: dbLatency,
                instance_id: realtimeEvents.instanceId
            },
            metrics: {
                total_online: await presenceTracker.getOnlineCount()
            }
        });
    } catch (err) {
        next(err);
    }
});


/**
 * SSE endpoint for real-time comment updates
 * GET /api/realtime/comments/:reportId
 * 
 * Keeps connection open and streams comment updates as they happen
 */
router.get('/comments/:reportId', (req, res) => {
    const { reportId } = req.params;

    // Essential for long-lived connections
    req.setTimeout(0);

    // Initialize Standard SSE Response
    const stream = new SSEResponse(res);

    logger.trace(`[SSE] Client connected for report ${reportId}`);

    // Confirm connection
    stream.send('connected', { reportId });

    // Start Keep-Alive Heartbeat (2s interval for stability)
    stream.startHeartbeat(2000);

    // Event Handlers - STRICT CONTRACT ADAPTERS
    const handleNewComment = (data) => {
        const { comment, originClientId, ...contract } = data;
        stream.send('new-comment', {
            id: comment.id,
            partial: comment,
            originClientId,
            ...contract
        });
    };

    const handleCommentUpdate = (data) => {
        const { comment, id, originClientId, ...rest } = data;

        // SSE Contract:
        // id: Target entity ID
        // partial: Object with updated fields
        // originClientId: for echo suppression
        // ...deltas: for atomic updates

        stream.send('comment-update', {
            id: id || comment?.id,
            partial: comment || (Object.keys(rest).length > 0 ? rest : null),
            originClientId,
            ...rest // Keep for deltas like isLikeDelta
        });
    };

    const handleCommentDelete = (data) => {
        const { commentId, originClientId, ...contract } = data;
        stream.send('comment-delete', {
            id: commentId,
            partial: null,
            originClientId,
            ...contract
        });
    };

    const handleReportUpdate = (data) => {
        // Payload from eventEmitter.emitVoteUpdate: { ...updates, originClientId, eventId, serverTimestamp }
        const { originClientId, eventId, serverTimestamp, sequence_id, ...updates } = data;

        stream.send('report-update', {
            id: reportId,
            partial: updates,
            originClientId,
            eventId,
            serverTimestamp,
            sequence_id
        });
    };

    // Subscribe to system events
    realtimeEvents.on(`comment:${reportId}`, handleNewComment);
    realtimeEvents.on(`comment-update:${reportId}`, handleCommentUpdate);
    realtimeEvents.on(`comment-delete:${reportId}`, handleCommentDelete);
    realtimeEvents.on(`report-update:${reportId}`, handleReportUpdate);

    // Cleanup on client disconnect
    req.on('close', () => {
        stream.cleanup();
        realtimeEvents.off(`comment:${reportId}`, handleNewComment);
        realtimeEvents.off(`comment-update:${reportId}`, handleCommentUpdate);
        realtimeEvents.off(`comment-delete:${reportId}`, handleCommentDelete);
        realtimeEvents.off(`report-update:${reportId}`, handleReportUpdate);
    });
});

/**
 * SSE endpoint for real-time chat messages
 * GET /api/realtime/chats/:roomId
 */
router.get('/chats/:roomId', async (req, res, next) => {
    const { roomId } = req.params;
    const anonymousId = getAuthenticatedAnonymousId(req);
    const isAdmin = hasAdminRole(req);

    if (!anonymousId) {
        logRealtimeForbidden(req, roomId, 'AUTH_REQUIRED', 401);
        return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED', true));
    }

    if (!isAdmin) {
        const isMember = await verifyMembership(anonymousId, roomId);
        if (!isMember) {
            logRealtimeForbidden(req, roomId, 'NOT_ROOM_MEMBER', 403);
            return next(new AppError('Access denied: Not a member of this conversation', 403, 'NOT_ROOM_MEMBER', true));
        }
    }

    req.setTimeout(0);

    const stream = new SSEResponse(res);
    logger.trace(`[SSE] Client connected for chat room ${roomId} (User: ${anonymousId})`);

    stream.send('connected', { roomId });
    stream.startHeartbeat(2000);

    // Event Handlers - UNIFIED CONTRACT
    const handleNewMessage = (data) => {
        const { message, originClientId, ...contract } = data;
        const conversationId = message?.conversation_id || data?.conversationId || data?.roomId || roomId;
        const eventId = contract.eventId || message?.id || `new-message:${conversationId}:${message?.id || 'unknown'}`;
        const serverTimestamp = contract.serverTimestamp || (message?.created_at ? new Date(message.created_at).getTime() : Date.now());
        stream.send('new-message', {
            id: message.id,
            conversationId,
            roomId: conversationId, // Backward compatibility temporal
            eventId,
            serverTimestamp,
            partial: message,
            originClientId: originClientId || contract.originClientId || 'backend',
            ...contract
        });
    };

    const handleTyping = (data) => {
        const { originClientId, eventId, serverTimestamp, ...payload } = data;
        const conversationId = payload.conversationId || payload.roomId || roomId;
        stream.send('typing', {
            id: roomId,
            conversationId,
            roomId: conversationId, // Backward compatibility temporal
            partial: payload,
            originClientId,
            eventId,
            serverTimestamp
        });
    };

    const handleRead = (data) => {
        const { originClientId, eventId, serverTimestamp, ...payload } = data;
        const conversationId = payload.conversationId || payload.roomId || roomId;
        stream.send('message.read', {
            id: data.id || data.messageId,
            conversationId,
            roomId: conversationId, // Backward compatibility temporal
            partial: payload,
            originClientId,
            eventId,
            serverTimestamp
        });
    };

    const handleMessageDelivered = (data) => {
        const { originClientId, eventId, serverTimestamp, ...payload } = data;
        const conversationId = payload.conversationId || payload.roomId || roomId;
        stream.send('message.delivered', {
            id: data.id || data.messageId,
            conversationId,
            roomId: conversationId, // Backward compatibility temporal
            partial: payload,
            originClientId,
            eventId,
            serverTimestamp
        });
    };

    const handlePresence = (data) => {
        const { originClientId, eventId, serverTimestamp, ...payload } = data;
        stream.send('presence', {
            id: data.userId,
            partial: payload,
            originClientId: originClientId || 'system',
            eventId,
            serverTimestamp
        });
    };

    // Suscribirse a eventos
    realtimeEvents.on(`chat:${roomId}`, handleNewMessage);
    realtimeEvents.on(`chat-typing:${roomId}`, handleTyping);
    realtimeEvents.on(`chat-read:${roomId}`, handleRead);
    realtimeEvents.on(`chat-delivered:${roomId}`, handleMessageDelivered);
    realtimeEvents.on(`chat-presence:${roomId}`, handlePresence);

    // Initial Presence Snapshot: Tell the connecting user if the other participant is online
    (async () => {
        try {
            // Find the other participant in this conversation
            const memberResult = await pool.query(
                `SELECT user_id FROM conversation_members 
                 WHERE conversation_id = $1 AND user_id != $2 
                 LIMIT 1`,
                [roomId, anonymousId]
            );

            if (memberResult.rows.length > 0) {
                const otherId = memberResult.rows[0].user_id;

                if (otherId) {
                    const isOtherOnline = await presenceTracker.isOnline(otherId);
                    // Send initial state directly to this specific stream
                    stream.send('presence', {
                        userId: otherId,
                        status: isOtherOnline ? 'online' : 'offline'
                    });
                }
            }
        } catch (err) {
            console.error('[SSE] Error sending presence snapshot:', err);
        }
    })();

    // Notificar que ESTE usuario entró (Online)
    if (anonymousId) {
        realtimeEvents.emitChatStatus('presence', roomId, {
            userId: anonymousId,
            status: 'online'
        });

        // 🏛️ ARCHITECTURAL FIX: ELIMINADO - ACK proactivo de delivered
        // El backend NO marca delivered al conectar a SSE room
        // ACK es responsabilidad EXCLUSIVA del cliente:
        // - RealtimeOrchestrator (SSE path)
        // - Service Worker (Push path)
    }

    req.on('close', () => {
        // Notificar que ESTE usuario salió (Offline)
        if (anonymousId) {
            realtimeEvents.emitChatStatus('presence', roomId, {
                userId: anonymousId,
                status: 'offline'
            });
        }

        stream.cleanup();
        realtimeEvents.off(`chat:${roomId}`, handleNewMessage);
        realtimeEvents.off(`chat-typing:${roomId}`, handleTyping);
        realtimeEvents.off(`chat-read:${roomId}`, handleRead);
        realtimeEvents.off(`chat-delivered:${roomId}`, handleMessageDelivered);
        realtimeEvents.off(`chat-presence:${roomId}`, handlePresence);
    });
});

/**
 * SSE endpoint for global user notifications (inbox updates)
 * GET /api/realtime/user/:anonymousId
 */
router.get('/user/:anonymousId', (req, res, next) => {
    const targetAnonymousId = req.params.anonymousId;
    const anonymousId = getAuthenticatedAnonymousId(req);
    if (!anonymousId) {
        logRealtimeForbidden(req, targetAnonymousId, 'AUTH_REQUIRED', 401);
        return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED', true));
    }
    if (anonymousId !== targetAnonymousId) {
        logRealtimeForbidden(req, targetAnonymousId, 'FORBIDDEN_STREAM', 403);
        return next(new AppError('Access denied: Cannot subscribe to another user stream', 403, 'FORBIDDEN_STREAM', true));
    }

    req.setTimeout(0);

    const stream = new SSEResponse(res);
    logger.trace(`[SSE] Client connected for user notifications ${anonymousId}`);

    stream.send('connected', { anonymousId });
    stream.startHeartbeat(15000, () => {
        // Refresh Redis presence on every heartbeat (15s < 60s TTL)
        presenceTracker.markOnline(anonymousId);
    });

    const handleChatUpdate = (data) => {
        // Enforce Enterprise Contract: eventId + serverTimestamp at ROOT level
        const eventId = data.eventId || data.id || `chat-update:${data.conversationId || data.roomId || 'unknown'}:${data.message?.id || 'state'}`;
        const serverTimestamp = data.serverTimestamp || Date.now();

        // 1. Prepare base payload
        const payload = {
            ...data,
            eventId,
            serverTimestamp
        };

        // 2. Ensure critical fields are mapped for client
        // 'id' is used by frontend caches
        if (!payload.id && data.conversationId) payload.id = data.conversationId;
        const conversationId = payload.conversationId || payload.roomId || data.conversationId || data.roomId || payload.id;

        stream.send('chat-update', {
            id: payload.id,
            conversationId,
            roomId: conversationId, // Backward compatibility temporal
            partial: payload,
            originClientId: data.originClientId,
            // Explicit Contract Fields
            eventId,
            serverTimestamp
        });
    };

    const handleMessageDelivered = (data) => {
        const { originClientId, eventId, serverTimestamp, ...payload } = data;
        const conversationId = payload.conversationId || payload.roomId || data.conversationId || data.roomId || data.id;
        stream.send('message.delivered', {
            id: data.id || data.messageId,
            conversationId,
            roomId: conversationId, // Backward compatibility temporal
            partial: payload,
            originClientId,
            eventId,
            serverTimestamp
        });
    };

    const handleMessageRead = (data) => {
        const { originClientId, eventId, serverTimestamp, ...payload } = data;
        const conversationId = payload.conversationId || payload.roomId || data.conversationId || data.roomId || data.id;
        stream.send('message.read', {
            id: data.id || data.messageId,
            conversationId,
            roomId: conversationId, // Backward compatibility temporal
            partial: payload,
            originClientId,
            eventId,
            serverTimestamp
        });
    };

    const handleNotification = (data) => {
        const { originClientId, eventId, serverTimestamp, ...payload } = data;
        stream.send('notification', {
            id: data.id || (data.notification && data.notification.id),
            partial: payload,
            originClientId,
            eventId,
            serverTimestamp
        });
    };

    const handleRollback = (data) => {
        const { originClientId, eventId, serverTimestamp, ...payload } = data;
        stream.send('chat-rollback', {
            id: data.id || data.conversationId,
            partial: payload,
            originClientId: originClientId || 'system',
            eventId,
            serverTimestamp
        });
    };

    const handlePresenceUpdate = (data) => {
        const { originClientId, eventId, serverTimestamp, ...payload } = data;
        stream.send('presence-update', {
            id: data.userId,
            partial: payload,
            originClientId: originClientId || 'system',
            eventId,
            serverTimestamp
        });
    };

    realtimeEvents.on(`user-chat-update:${anonymousId}`, handleChatUpdate);
    realtimeEvents.on(`user-message-delivered:${anonymousId}`, handleMessageDelivered);
    realtimeEvents.on(`user-message-read:${anonymousId}`, handleMessageRead);
    realtimeEvents.on(`user-notification:${anonymousId}`, handleNotification);
    realtimeEvents.on(`user-chat-rollback:${anonymousId}`, handleRollback);
    realtimeEvents.on('presence-update', handlePresenceUpdate);

    // FASE 3: Registrar conexión con contador de sesiones (Multi-tab)
    presenceTracker.trackConnect(anonymousId);

    // 🏛️ WHATSAPP-GRADE: Enviar mensajes pendientes y marcar delivered
    // Cuando el receptor se conecta, buscar mensajes no delivered donde él es receptor
    (async () => {
        try {
            const pendingMessages = await pool.query(
                `SELECT cm.*, u.alias as sender_alias, u.avatar_url as sender_avatar
                 FROM chat_messages cm
                 JOIN conversation_members mem ON cm.conversation_id = mem.conversation_id
                 JOIN anonymous_users u ON cm.sender_id = u.anonymous_id
                 WHERE mem.user_id = $1
                   AND cm.sender_id != $1
                   AND cm.is_delivered = false
                 ORDER BY cm.created_at ASC
                 LIMIT 50`,
                [anonymousId]
            );

            if (pendingMessages.rows.length > 0) {
                console.log(`[SSE] Sending ${pendingMessages.rows.length} pending messages to ${anonymousId}`);
                
                const deliveredAt = new Date();
                
                for (const msg of pendingMessages.rows) {
                    const pendingServerTs = new Date(msg.created_at).getTime();
                    // Emitir mensaje al receptor
                    stream.send('new-message', {
                        id: msg.id,
                        conversationId: msg.conversation_id,
                        roomId: msg.conversation_id, // Backward compatibility temporal
                        partial: {
                            message: msg,
                            originClientId: 'system_pending'
                        },
                        originClientId: 'system_pending',
                        eventId: `pending_${msg.id}`,
                        serverTimestamp: pendingServerTs
                    });

                    // Marcar como delivered
                    await pool.query(
                        'UPDATE chat_messages SET is_delivered = true, delivered_at = $1 WHERE id = $2',
                        [deliveredAt, msg.id]
                    );

                    logger.info('CHAT_PIPELINE', {
                        stage: 'ACK_UPDATE_DB',
                        result: 'ok',
                        requestId: req.requestId || req.id || req.headers['x-request-id'] || null,
                        actorId: anonymousId,
                        targetId: msg.sender_id,
                        conversationId: msg.conversation_id,
                        messageId: msg.id,
                        ackType: 'delivered_reconnect'
                    });

                    // Notificar al sender
                    realtimeEvents.emitMessageDelivered(msg.sender_id, {
                        messageId: msg.id,
                        id: msg.id,
                        conversationId: msg.conversation_id,
                        deliveredAt: deliveredAt,
                        receiverId: anonymousId,
                        traceId: `auto_reconnect_${Date.now()}`
                    });
                }
            }
        } catch (err) {
            console.error('[SSE] Error sending pending messages:', err);
        }
    })();

    req.on('close', () => {
        // FASE 3: Decrementar sesiones (Stateless multi-tab)
        // Solo si es la última pestaña, se emite 'offline' dentro de trackDisconnect.
        presenceTracker.trackDisconnect(anonymousId);

        logger.trace(`[SSE] Client disconnected ${anonymousId}`);

        stream.cleanup();
        realtimeEvents.off(`user-chat-update:${anonymousId}`, handleChatUpdate);
        realtimeEvents.off(`user-message-delivered:${anonymousId}`, handleMessageDelivered);
        realtimeEvents.off(`user-notification:${anonymousId}`, handleNotification);
        realtimeEvents.off(`user-chat-rollback:${anonymousId}`, handleRollback);
        realtimeEvents.off('presence-update', handlePresenceUpdate);
    });

});

/**
 * SSE endpoint for global feed updates (e.g. counters for home page)
 * GET /api/realtime/feed
 */
router.get('/feed', (req, res) => {
    req.setTimeout(0);
    const stream = new SSEResponse(res);
    // console.log('[SSE] Client connected to Global Feed');

    // Confirm connection
    stream.send('connected', { feed: 'global' });
    stream.startHeartbeat(10000); // 10s heartbeat for global feed (less aggressive)

    const handleGlobalUpdate = (data) => {
        // Demultiplex global events into specific strict events:

        // 🛡️ Enterprise Invariant: Hard Guard for Contract Fields
        if (!data.eventId || !data.serverTimestamp) {
            console.error('[SSE] ❌ INVARIANT VIOLATION: Event missing contract fields', data);
            return; // Dropping invalid event at source rather than sending broken contract
        }

        // Common contract fields
        const contract = {
            eventId: data.eventId,
            serverTimestamp: data.serverTimestamp,
            originClientId: data.originClientId
        };

        // 1. New Report
        if (data.type === 'new-report') {
            stream.send('report-create', {
                id: data.report.id,
                partial: data.report,
                ...contract
            });
        }
        // 2. Report/Stats Update
        else if (data.type === 'report-update' || data.type === 'stats-update') {
            stream.send('report-update', {
                id: data.reportId || data.id,
                partial: data.updates || data.partial,
                ...contract
            });
        }
        // 3. Status Change (Counters)
        else if (data.type === 'status-change') {
            stream.send('status-change', {
                id: data.reportId,
                prevStatus: data.prevStatus,
                newStatus: data.newStatus,
                ...contract
            });
        }
        // 4. New User (Counters)
        else if (data.type === 'new-user') {
            stream.send('user-create', {
                anonymousId: data.anonymousId,
                ...contract
            });
        }
        // 5. Deletion
        else if (data.type === 'delete') {
            stream.send('report-delete', {
                id: data.reportId,
                category: data.category,
                status: data.status,
                ...contract
            });
        }
    };

    realtimeEvents.on('global-report-update', handleGlobalUpdate);

    req.on('close', () => {
        stream.cleanup();
        realtimeEvents.off('global-report-update', handleGlobalUpdate);
    });
});

export default router;
