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

    /**
     * Emit a user ban/unban event
     * @param {string} anonymousId - The user ID
     * @param {object} data - { status: 'banned' | 'active', reason: string }
     */
    emitUserBan(anonymousId, data) {
        this.emit(`user-status:${anonymousId}`, data);
        console.log(`[Realtime] Emitted user status change for ${anonymousId}`, data);
    }

    /**
     * Emit a new report event (Global Feed)
     * @param {object} report - The full report object (or minimal summary)
     */
    emitNewReport(report) {
        // Broadcast to 'global-report-update' channel which /api/realtime/feed listens to
        this.emit('global-report-update', {
            type: 'new-report',
            report: report
        });
        console.log(`[Realtime] Emitted new report ${report.id} to global feed`);
    }

    /**
     * Emit a vote/like update
     * @param {string} type - 'report' or 'comment'
     * @param {string} id - The Item ID
     * @param {object} updates - Changed fields (e.g. { upvotes_count: 5 })
     */
    emitVoteUpdate(type, id, updates) {
        if (type === 'report') {
            // Update detail view listeners
            this.emit(`report-update:${id}`, updates);

            // Update global feed listeners
            this.emit('global-report-update', {
                type: 'stats-update',
                reportId: id,
                updates
            });
        } else if (type === 'comment') {
            // Update comment listeners (in report detail)
            // Note: comments are usually listened to via the parent report channel
            // We might need to handle this differently if we don't have reportId here.
            // But usually we do or can fetch it. 
            // For now, let's assume specific comment update.
            this.emit(`comment-update:${id}`, updates); // This might need a reportId prefix if clients listen by report
        }
        console.log(`[Realtime] Emitted vote update for ${type} ${id}`, updates);
    }

    /**
     * Emit a badge earned event (Personal Notification)
     * @param {string} anonymousId - The recipient
     * @param {object} badge - The badge object
     */
    emitBadgeEarned(anonymousId, badge) {
        this.emit(`user-notification:${anonymousId}`, {
            type: 'achievement',
            title: '🏆 ¡Nueva Insignia Desbloqueada!',
            message: `Has ganado la insignia "${badge.name}".`,
            badge
        });
        console.log(`[Realtime] Emitted badge earned for ${anonymousId}`, badge.code);
    }
}

// Export singleton instance
export const realtimeEvents = new RealtimeEvents();
