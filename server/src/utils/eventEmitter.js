import EventEmitter from 'events';

/**
 * Global Event Emitter for Real-time Updates
 * Used to broadcast events across the application
 */
class RealtimeEvents extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(100); // Allow many concurrent SSE connections
    }

    /**
     * Emit a new comment event
     * @param {string} reportId - The report ID
     * @param {object} comment - The comment data
     */
    emitNewComment(reportId, comment) {
        this.emit(`comment:${reportId}`, comment);
        console.log(`[Realtime] Emitted new comment for report ${reportId}`);
    }

    /**
     * Emit a comment update event
     * @param {string} reportId - The report ID
     * @param {object} comment - The updated comment data
     */
    emitCommentUpdate(reportId, comment) {
        this.emit(`comment-update:${reportId}`, comment);
        console.log(`[Realtime] Emitted comment update for report ${reportId}`);
    }

    /**
     * Emit a comment delete event
     * @param {string} reportId - The report ID
     * @param {string} commentId - The deleted comment ID
     */
    emitCommentDelete(reportId, commentId) {
        this.emit(`comment-delete:${reportId}`, { commentId });
        console.log(`[Realtime] Emitted comment delete for report ${reportId}`);
    }
}

// Export singleton instance
export const realtimeEvents = new RealtimeEvents();
