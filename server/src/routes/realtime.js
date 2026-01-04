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

    // Subscribe to system events
    realtimeEvents.on(`comment:${reportId}`, handleNewComment);
    realtimeEvents.on(`comment-update:${reportId}`, handleCommentUpdate);
    realtimeEvents.on(`comment-delete:${reportId}`, handleCommentDelete);

    // Cleanup on client disconnect
    req.on('close', () => {
        stream.cleanup();
        realtimeEvents.off(`comment:${reportId}`, handleNewComment);
        realtimeEvents.off(`comment-update:${reportId}`, handleCommentUpdate);
        realtimeEvents.off(`comment-delete:${reportId}`, handleCommentDelete);
    });
});

/**
 * SSE endpoint for real-time chat messages
 * GET /api/realtime/chats/:roomId
 */
router.get('/chats/:roomId', (req, res) => {
    const { roomId } = req.params;
    req.setTimeout(0);

    const stream = new SSEResponse(res);
    console.log(`[SSE] Client connected for chat room ${roomId}`);

    stream.send('connected', { roomId });
    stream.startHeartbeat(2000);

    const handleNewMessage = (message) => {
        stream.send('new-message', { message });
    };

    const handleTyping = (data) => {
        stream.send('typing', data);
    };

    realtimeEvents.on(`chat:${roomId}`, handleNewMessage);
    realtimeEvents.on(`chat-typing:${roomId}`, handleTyping);

    req.on('close', () => {
        stream.cleanup();
        realtimeEvents.off(`chat:${roomId}`, handleNewMessage);
        realtimeEvents.off(`chat-typing:${roomId}`, handleTyping);
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

    realtimeEvents.on(`user-chat-update:${anonymousId}`, handleChatUpdate);

    req.on('close', () => {
        stream.cleanup();
        realtimeEvents.off(`user-chat-update:${anonymousId}`, handleChatUpdate);
    });
});

export default router;
