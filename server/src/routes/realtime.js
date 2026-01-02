import express from 'express';
import { realtimeEvents } from '../utils/eventEmitter.js';

const router = express.Router();

/**
 * SSE endpoint for real-time comment updates
 * GET /api/realtime/comments/:reportId
 * 
 * Keeps connection open and streams comment updates as they happen
 */
router.get('/comments/:reportId', (req, res) => {
    const { reportId } = req.params;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    console.log(`[SSE] Client connected for report ${reportId}`);

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'connected', reportId })}\n\n`);

    // Handler for new comments
    const handleNewComment = (comment) => {
        const data = JSON.stringify({ type: 'new-comment', comment });
        res.write(`data: ${data}\n\n`);
    };

    // Handler for comment updates
    const handleCommentUpdate = (comment) => {
        const data = JSON.stringify({ type: 'comment-update', comment });
        res.write(`data: ${data}\n\n`);
    };

    // Handler for comment deletes
    const handleCommentDelete = (payload) => {
        const data = JSON.stringify({ type: 'comment-delete', ...payload });
        res.write(`data: ${data}\n\n`);
    };

    // Subscribe to events for this report
    realtimeEvents.on(`comment:${reportId}`, handleNewComment);
    realtimeEvents.on(`comment-update:${reportId}`, handleCommentUpdate);
    realtimeEvents.on(`comment-delete:${reportId}`, handleCommentDelete);

    // Heartbeat to keep connection alive (every 30s)
    const heartbeat = setInterval(() => {
        res.write(`: heartbeat\n\n`);
    }, 30000);

    // Cleanup on client disconnect
    req.on('close', () => {
        console.log(`[SSE] Client disconnected from report ${reportId}`);
        clearInterval(heartbeat);
        realtimeEvents.off(`comment:${reportId}`, handleNewComment);
        realtimeEvents.off(`comment-update:${reportId}`, handleCommentUpdate);
        realtimeEvents.off(`comment-delete:${reportId}`, handleCommentDelete);
        res.end();
    });
});

export default router;
