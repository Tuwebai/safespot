import express from 'express';
import { realtimeEvents } from '../utils/eventEmitter.js';
import { SSEResponse } from '../utils/sseResponse.js';

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

    // Event Handlers
    const handleNewComment = (comment) => {
        stream.send('new-comment', { comment });
    };

    const handleCommentUpdate = (comment) => {
        stream.send('comment-update', { comment });
    };

    const handleCommentDelete = (payload) => {
        stream.send('comment-delete', payload);
    };

    const handleReportUpdate = (payload) => {
        // Broadcast generic report updates (e.g. stats/likes)
        stream.send('report-update', payload);
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
    const handleNewMessage = (message) => {
        stream.send('new-message', { message });
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
                await queryWithRLS(anonymousId,
                    'UPDATE chat_messages SET is_delivered = true WHERE room_id = $1 AND sender_id != $2 AND is_delivered = false',
                    [roomId, anonymousId]
                );
                // Notificar que se entregaron mensajes
                realtimeEvents.emit(`chat-delivered:${roomId}`, {
                    receiverId: anonymousId
                });
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

    realtimeEvents.on(`user-chat-update:${anonymousId}`, handleChatUpdate);
    realtimeEvents.on(`user-notification:${anonymousId}`, handleNotification);

    req.on('close', () => {
        stream.cleanup();
        realtimeEvents.off(`user-chat-update:${anonymousId}`, handleChatUpdate);
        realtimeEvents.off(`user-notification:${anonymousId}`, handleNotification);
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
        stream.send('global-report-update', data);
    };

    realtimeEvents.on('global-report-update', handleGlobalUpdate);

    req.on('close', () => {
        stream.cleanup();
        realtimeEvents.off('global-report-update', handleGlobalUpdate);
    });
});

export default router;
