import express from 'express';
import { realtimeEvents } from '../utils/eventEmitter.js';
import { SSEResponse } from '../utils/sseResponse.js';
import { presenceTracker } from '../utils/presenceTracker.js';
import pool from '../config/database.js';


import redis, { redisSubscriber } from '../config/redis.js';
import { eventDeduplicator } from '../engine/DeliveryLedger.js';

const router = express.Router();

/**
 * POST /api/realtime/ack/:eventId
 * Acknowledge receipt of an EVENT (technical deduplication)
 * ⚠️ This is NOT message delivery - that's handled by /chats/messages/:id/ack-delivered
 */
router.post('/ack/:eventId', async (req, res) => {
    const { eventId } = req.params;
    try {
        // 🏛️ SSOT: This marks the EVENT as processed (deduplication)
        // Message delivered status is in PostgreSQL, not here
        await eventDeduplicator.markProcessed(eventId);
        res.json({ success: true, eventId });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/realtime/catchup
 * 🚑 Gap Catchup API for Realtime Orchestrator
 * Returns missed domain events since a given serverTimestamp
 */
router.get('/catchup', async (req, res) => {
    const { since } = req.query;
    if (!since) return res.status(400).json({ error: 'Missing since timestamp' });

    try {
        const sinceTs = parseInt(since);

        // 1. Fetch missed Chat Messages OR missed Delivery ACKs
        const messageTask = pool.query(
            `SELECT m.* FROM chat_messages m
             WHERE (EXTRACT(EPOCH FROM m.created_at) * 1000 > $1)
             OR (EXTRACT(EPOCH FROM m.delivered_at) * 1000 > $1)
             ORDER BY GREATEST(m.created_at, m.delivered_at) ASC LIMIT 50`,
            [sinceTs]
        );

        // 2. Fetch missed Reports (New ones only for catchup feed)
        const reportTask = pool.query(
            `SELECT r.*, u.alias, u.avatar_url FROM reports r
             LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
             WHERE (EXTRACT(EPOCH FROM r.created_at) * 1000 > $1)
             ORDER BY r.created_at ASC LIMIT 50`,
            [sinceTs]
        );

        const [messagesResult, reportsResult] = await Promise.all([messageTask, reportTask]);

        const events = [];

        // Process Reports
        reportsResult.rows.forEach(r => {
            const ts = new Date(r.created_at).getTime();
            events.push({
                eventId: `rep_${r.id}`,
                serverTimestamp: ts,
                type: 'report-create',
                payload: {
                    id: r.id,
                    partial: {
                        ...r,
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

        res.json(events);
    } catch (err) {
        console.error('[Catchup] Error:', err);
        res.status(500).json({ error: 'Catchup failed', details: err.message });
    }
});

/**
 * GET /api/realtime/status/:eventId
 * Check processing status of an event (technical deduplication)
 * ⚠️ DEPRECATED: For message delivery status use /message-status/:messageId (PostgreSQL SSOT)
 */
router.get('/status/:eventId', async (req, res) => {
    const { eventId } = req.params;
    try {
        const status = await eventDeduplicator.getStatus(eventId);
        res.json(status || { status: 'not_found' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/realtime/message-status/:messageId
 * 🏛️ SSOT: Check message delivery status from PostgreSQL (NOT Redis)
 * 
 * This is the AUTHORITATIVE source for delivered/read state.
 * SW uses this for Push suppression instead of Redis.
 */
router.get('/message-status/:messageId', async (req, res) => {
    const { messageId } = req.params;
    try {
        const result = await pool.query(
            'SELECT is_delivered, is_read FROM chat_messages WHERE id = $1',
            [messageId]
        );

        if (result.rows.length === 0) {
            // Message not found - allow Push (fail-open)
            return res.json({ delivered: false, read: false });
        }

        res.json({
            delivered: result.rows[0].is_delivered || false,
            read: result.rows[0].is_read || false
        });
    } catch (err) {
        console.error('[SSOT] Error fetching message status:', err);
        // Fail-open: if we can't check, allow Push
        res.status(500).json({ delivered: false, read: false });
    }
});

/**
 * GET /api/realtime/status
 * Health check for the real-time infrastructure (Redis + SSE Tracker)
 */
router.get('/status', async (req, res) => {
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
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            error: err.message
        });
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

    console.log(`[SSE] Client connected for report ${reportId}`);

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

    const handleReportUpdate = (payload) => {
        // Payload from eventEmitter.emitVoteUpdate: { ...updates, originClientId }
        // We need to extract ID. 
        // Note: report-update events usually come from emitVoteUpdate('report', id, updates)
        // Check eventEmitter.js: emit(`report-update:${id}`, { ...updates, originClientId })
        // It does NOT include ID in the object, because the channel includes it.
        // But the handler needs it? checking realtime.js:43... it receives 'payload'.
        // If the payload from emitVoteUpdate doesn't have ID, we can't send it?
        // Wait, the listener `realtimeEvents.on('report-update:${reportId}', ...)`
        // We know reportId from scope!

        const { originClientId, ...updates } = payload;
        stream.send('report-update', {
            id: reportId,
            partial: updates,
            originClientId
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
router.get('/chats/:roomId', (req, res) => {
    const { roomId } = req.params;
    const { anonymousId } = req.query; // Recibimos el ID para saber quién está en línea

    req.setTimeout(0);

    const stream = new SSEResponse(res);
    console.log(`[SSE] Client connected for chat room ${roomId} (User: ${anonymousId})`);

    stream.send('connected', { roomId });
    stream.startHeartbeat(2000);

    // Event Handlers - UNIFIED CONTRACT
    const handleNewMessage = (data) => {
        const { message, originClientId, ...contract } = data;
        stream.send('new-message', {
            id: message.id,
            partial: message,
            originClientId,
            ...contract
        });
    };

    const handleTyping = (data) => {
        stream.send('typing', {
            id: roomId,
            partial: data,
            originClientId: data.originClientId
        });
    };

    const handleRead = (data) => {
        stream.send('message.read', {
            id: data.id || data.messageId,
            partial: data,
            originClientId: data.originClientId
        });
    };

    const handleMessageDelivered = (data) => {
        stream.send('message.delivered', {
            id: data.id || data.messageId,
            partial: data,
            originClientId: data.originClientId
        });
    };

    const handlePresence = (data) => {
        stream.send('presence', {
            id: data.userId,
            partial: data,
            originClientId: 'system'
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
router.get('/user/:anonymousId', (req, res) => {
    const { anonymousId } = req.params;
    req.setTimeout(0);

    const stream = new SSEResponse(res);
    console.log(`[SSE] Client connected for user notifications ${anonymousId} (Events ID: ${realtimeEvents.instanceId})`);

    stream.send('connected', { anonymousId });
    stream.startHeartbeat(15000, () => {
        // Refresh Redis presence on every heartbeat (15s < 60s TTL)
        presenceTracker.markOnline(anonymousId);
    });

    const handleChatUpdate = (data) => {
        stream.send('chat-update', {
            id: data.id || data.conversationId,
            partial: data,
            originClientId: data.originClientId
        });
    };

    const handleMessageDelivered = (data) => {
        stream.send('message.delivered', {
            id: data.id || data.messageId,
            partial: data,
            originClientId: data.originClientId
        });
    };

    const handleMessageRead = (data) => {
        stream.send('message.read', {
            id: data.id || data.messageId,
            partial: data,
            originClientId: data.originClientId
        });
    };

    const handleNotification = (data) => {
        stream.send('notification', {
            id: data.id || (data.notification && data.notification.id),
            partial: data,
            originClientId: data.originClientId
        });
    };

    const handleRollback = (data) => {
        stream.send('chat-rollback', {
            id: data.id || data.conversationId,
            partial: data,
            originClientId: 'system'
        });
    };

    const handlePresenceUpdate = (data) => {
        stream.send('presence-update', {
            id: data.userId,
            partial: data,
            originClientId: 'system'
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

    req.on('close', () => {
        // FASE 3: Decrementar sesiones (Stateless multi-tab)
        // Solo si es la última pestaña, se emite 'offline' dentro de trackDisconnect.
        presenceTracker.trackDisconnect(anonymousId);

        console.log(`[SSE] Client disconnected ${anonymousId}`);

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
