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

    // Start Keep-Alive Heartbeat (5s interval for stability)
    stream.startHeartbeat(5000);

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
        console.log(`[SSE] Client disconnected from report ${reportId}`);
        stream.cleanup();
        realtimeEvents.off(`comment:${reportId}`, handleNewComment);
        realtimeEvents.off(`comment-update:${reportId}`, handleCommentUpdate);
        realtimeEvents.off(`comment-delete:${reportId}`, handleCommentDelete);
        res.end();
    });
});

export default router;
