import express from 'express';
import { realtimeEvents } from '../utils/eventEmitter.js';
import { SSEResponse } from '../utils/sseResponse.js';
import { presenceTracker } from '../utils/presenceTracker.js';
import pool from '../config/database.js';


import redis, { redisSubscriber } from '../config/redis.js';
import { deliveryLedger } from '../engine/DeliveryLedger.js';

const router = express.Router();

/**
 * POST /api/realtime/ack/:eventId
 * Acknowledge receipt of a message (logical delivery confirmation)
 */
router.post('/ack/:eventId', async (req, res) => {
    const { eventId } = req.params;
    try {
        await deliveryLedger.markDelivered(eventId);
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

        // 1. Fetch missed Chat Messages
        // We map them to the RealtimeEvent contract
        const messagesResult = await pool.query(
            `SELECT m.*, c.user_id as recipient_id
					 FROM chat_messages m
					 JOIN conversation_members c ON m.conversation_id = c.conversation_id
					 WHERE EXTRACT(EPOCH FROM m.created_at) * 1000 > $1
					 ORDER BY m.created_at ASC
					 LIMIT 50`,
            [sinceTs]
        );


        const events = messagesResult.rows.map(m => ({
            eventId: `msg_${m.id}`, // Synthetic eventId based on DB ID if missing
            serverTimestamp: new Date(m.created_at).getTime(),
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
        }));

        res.json(events);
    } catch (err) {
        console.error('[Catchup] Error:', err);
        res.status(500).json({ error: 'Catchup failed', details: err.message });
    }
});

/**
 * GET /api/realtime/status/:eventId
 * Check logical delivery status of an event
 */
router.get('/status/:eventId', async (req, res) => {
    const { eventId } = req.params;
    try {
        const status = await deliveryLedger.getStatus(eventId);
        res.json(status || { status: 'not_found' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
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

    // Event Handlers
    const handleNewMessage = (data) => {
        stream.send('new-message', data);
    };

    const handleTyping = (data) => {
        stream.send('typing', data);
    };

    const handleRead = (data) => {
        // Notificar que los mensajes fueron leídos (doble tilde vv)
        stream.send('message.read', data);
    };

    const handleMessageDelivered = (data) => {
        // Notificar que los mensajes fueron entregados (doble tilde gris vv)
        stream.send('message.delivered', data);
    };

    const handlePresence = (data) => {
        // Notificar quién entró o salió de la sala
        stream.send('presence', data);
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

        // Al entrar, marcar mensajes de otros como ENTREGADOS
        (async () => {
            try {
                const { queryWithRLS } = await import('../utils/rls.js');

                // ✅ WhatsApp-Grade: Get senders of undelivered messages BEFORE marking them
                const sendersResult = await queryWithRLS(anonymousId,
                    `SELECT DISTINCT sender_id FROM chat_messages 
                     WHERE conversation_id = $1 AND sender_id != $2 AND is_delivered = false`,
                    [roomId, anonymousId]
                );
                const senderIds = sendersResult.rows.map(r => r.sender_id);

                // Mark as delivered
                const result = await queryWithRLS(anonymousId,
                    'UPDATE chat_messages SET is_delivered = true WHERE conversation_id = $1 AND sender_id != $2 AND is_delivered = false',
                    [roomId, anonymousId]
                );

                // SOLO emitir si realmente se actualizaron mensajes
                if (result.rowCount > 0) {
                    // 1. Room SSE (for clients with chat open)
                    realtimeEvents.emitChatStatus('delivered', roomId, {
                        conversationId: roomId,
                        receiverId: anonymousId
                    });

                    // 2. ✅ WhatsApp-Grade: Notify senders via their user SSE (for double-tick everywhere)
                    senderIds.forEach(senderId => {
                        realtimeEvents.emitMessageDelivered(senderId, {
                            conversationId: roomId,
                            receiverId: anonymousId,
                            traceId: `bulk_delivered_${Date.now()}`
                        });
                    });
                }
            } catch (err) {
                console.error('[SSE] Error marking as delivered on connect:', err);
            }
        })();
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
        stream.send('chat-update', data);
    };

    const handleMessageDelivered = (data) => {
        stream.send('message.delivered', data);
    };

    const handleMessageRead = (data) => {
        stream.send('message.read', data);
    };

    const handleNotification = (data) => {
        stream.send('notification', data);
    };

    const handleRollback = (data) => {
        stream.send('chat-rollback', data);
    };

    const handlePresenceUpdate = (data) => {
        stream.send('presence-update', data);
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

        // 1. New Report
        if (data.type === 'new-report') {
            stream.send('report-create', {
                id: data.report.id,
                partial: data.report,
                originClientId: data.originClientId
            });
        }
        // 2. Report/Stats Update
        else if (data.type === 'report-update' || data.type === 'stats-update') {
            stream.send('report-update', {
                id: data.reportId || data.id,
                partial: data.updates || data.partial,
                originClientId: data.originClientId
            });
        }
        // 3. Status Change (Counters)
        else if (data.type === 'status-change') {
            stream.send('status-change', {
                id: data.reportId,
                prevStatus: data.prevStatus,
                newStatus: data.newStatus,
                originClientId: data.originClientId
            });
        }
        // 4. New User (Counters)
        else if (data.type === 'new-user') {
            stream.send('user-create', {
                anonymousId: data.anonymousId
            });
        }
        // 5. Deletion
        else if (data.type === 'delete') {
            stream.send('report-delete', {
                id: data.reportId,
                category: data.category,
                status: data.status,
                originClientId: data.originClientId
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
