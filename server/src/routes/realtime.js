import express from 'express';
import { realtimeEvents } from '../utils/eventEmitter.js';
import { SSEResponse } from '../utils/sseResponse.js';
import { presenceTracker } from '../utils/presenceTracker.js';
import pool from '../config/database.js';


const router = express.Router();


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
    const handleNewComment = ({ comment, originClientId }) => {
        stream.send('new-comment', {
            id: comment.id,
            partial: comment,
            originClientId
        });
    };

    const handleCommentUpdate = ({ comment, originClientId }) => {
        stream.send('comment-update', {
            id: comment.id,
            partial: comment,
            originClientId
        });
    };

    const handleCommentDelete = ({ commentId, originClientId }) => {
        stream.send('comment-delete', {
            id: commentId,
            partial: null,
            originClientId
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
    const handleNewMessage = ({ message, originClientId }) => {
        stream.send('new-message', { message, originClientId });
    };

    const handleTyping = (data) => {
        stream.send('typing', data);
    };

    const handleRead = (data) => {
        // Notificar que los mensajes fueron leídos (doble tilde vv)
        stream.send('messages-read', data);
    };

    const handleDelivered = (data) => {
        // Notificar que los mensajes fueron entregados (doble tilde gris vv)
        stream.send('messages-delivered', data);
    };

    const handlePresence = (data) => {
        // Notificar quién entró o salió de la sala
        stream.send('presence', data);
    };

    // Suscribirse a eventos
    realtimeEvents.on(`chat:${roomId}`, handleNewMessage);
    realtimeEvents.on(`chat-typing:${roomId}`, handleTyping);
    realtimeEvents.on(`chat-read:${roomId}`, handleRead);
    realtimeEvents.on(`chat-delivered:${roomId}`, handleDelivered);
    realtimeEvents.on(`chat-presence:${roomId}`, handlePresence);

    // Notificar que ESTE usuario entró (Online)
    if (anonymousId) {
        realtimeEvents.emit(`chat-presence:${roomId}`, {
            userId: anonymousId,
            status: 'online'
        });

        // Al entrar, marcar mensajes de otros como ENTREGADOS
        (async () => {
            try {
                const { queryWithRLS } = await import('../utils/rls.js');
                const result = await queryWithRLS(anonymousId,
                    'UPDATE chat_messages SET is_delivered = true WHERE conversation_id = $1 AND sender_id != $2 AND is_delivered = false',
                    [roomId, anonymousId]
                );

                // SOLO emitir si realmente se actualizaron mensajes
                if (result.rowCount > 0) {
                    realtimeEvents.emit(`chat-delivered:${roomId}`, {
                        receiverId: anonymousId
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
            realtimeEvents.emit(`chat-presence:${roomId}`, {
                userId: anonymousId,
                status: 'offline'
            });
        }

        stream.cleanup();
        realtimeEvents.off(`chat:${roomId}`, handleNewMessage);
        realtimeEvents.off(`chat-typing:${roomId}`, handleTyping);
        realtimeEvents.off(`chat-read:${roomId}`, handleRead);
        realtimeEvents.off(`chat-delivered:${roomId}`, handleDelivered);
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
    console.log(`[SSE] Client connected for user notifications ${anonymousId}`);

    stream.send('connected', { anonymousId });
    stream.startHeartbeat(2000);

    const handleChatUpdate = (data) => {
        stream.send('chat-update', data);
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

    realtimeEvents.on(`user-notification:${anonymousId}`, handleNotification);
    realtimeEvents.on(`user-chat-rollback:${anonymousId}`, handleRollback);
    realtimeEvents.on('presence-update', handlePresenceUpdate);

    // FASE 1: Registrar conexión en PresenceTracker
    presenceTracker.addConnection(anonymousId);

    req.on('close', () => {
        // FASE 1: Registrar desconexión
        const lastSeen = presenceTracker.removeConnection(anonymousId);

        if (lastSeen) {
            // Update DB only on actual disconnect (last tab)
            (async () => {
                try {
                    // Safety check for the pool (imported at top level)
                    if (pool && typeof pool.query === 'function') {
                        await pool.query('UPDATE anonymous_users SET last_seen_at = $1 WHERE anonymous_id = $2', [lastSeen, anonymousId]);
                    }
                } catch (err) {
                    console.error('[Presence] Error updating last_seen_at:', err);
                }
            })();


        }


        stream.cleanup();
        realtimeEvents.off(`user-chat-update:${anonymousId}`, handleChatUpdate);
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
        // 2. Stats/Status Update
        else if (data.type === 'stats-update' || data.type === 'report-update') {
            stream.send('report-update', {
                id: data.reportId || data.id,
                partial: data.updates || data.partial, // Handle both formats if flexible, but strict is 'updates' from emitter
                originClientId: data.originClientId
            });
        }
        // 3. Deletion
        else if (data.type === 'delete') {
            stream.send('report-delete', {
                id: data.reportId,
                partial: null,
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
