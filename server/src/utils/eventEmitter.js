import EventEmitter from 'events';

/**
 * Global Event Emitter for Real-time Updates
 * Used to broadcast events across the application
 */
class RealtimeEvents extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(100); // Allow many concurrent SSE connections
        this.instanceId = Math.random().toString(36).substring(7);
        console.log(`[RealtimeEvents] Instance created: ${this.instanceId}`);
    }

    /**
     * Emit a new comment event
     * @param {string} reportId - The report ID
     * @param {object} comment - The comment data
     * @param {string} [originClientId] - The Client ID that caused this event (to exclude from echo)
     */
    emitNewComment(reportId, comment, originClientId) {
        this.emit(`comment:${reportId}`, { comment, originClientId });
        console.log(`[Realtime] Emitted new comment for report ${reportId} (Client: ${originClientId || 'unknown'})`);
    }

    /**
     * Emit a comment update event
     * @param {string} reportId - The report ID
     * @param {object} comment - The updated comment data
     * @param {string} [originClientId]
     */
    emitCommentUpdate(reportId, comment, originClientId) {
        this.emit(`comment-update:${reportId}`, { comment, originClientId });
        console.log(`[Realtime] Emitted comment update for report ${reportId}`);
    }

    /**
     * Emit a comment delete event
     * @param {string} reportId - The report ID
     * @param {string} commentId - The deleted comment ID
     * @param {string} [originClientId]
     */
    emitCommentDelete(reportId, commentId, originClientId) {
        this.emit(`comment-delete:${reportId}`, { commentId, originClientId });
        console.log(`[Realtime] Emitted comment delete for report ${reportId}`);
    }

    /**
     * Emit a new report event (Global Feed)
     * @param {object} report - The full report object (or minimal summary)
     * @param {string} [originClientId]
     */
    emitNewReport(report, originClientId) {
        // Broadcast to 'global-report-update' channel which /api/realtime/feed listens to
        this.emit('global-report-update', {
            type: 'new-report',
            report: report,
            originClientId
        });
        console.log(`[Realtime] Emitted new report ${report.id} to global feed (Client: ${originClientId || 'unknown'})`);
    }

    /**
     * Emit a global report deletion event
     * @param {string} reportId
     * @param {string} [originClientId]
     */
    emitReportDelete(reportId, originClientId) {
        this.emit('global-report-update', {
            type: 'delete',
            reportId,
            originClientId
        });
        console.log(`[Realtime] Emitted report delete ${reportId} (Client: ${originClientId || 'unknown'})`);
    }

    /**
     * Emit a vote/like update
     * @param {string} type - 'report' or 'comment'
     * @param {string} id - The Item ID
     * @param {object} updates - Changed fields (e.g. { upvotes_count: 5 })
     * @param {string} [originClientId]
     */
    emitVoteUpdate(type, id, updates, originClientId) {
        if (type === 'report') {
            // Update detail view listeners
            this.emit(`report-update:${id}`, { ...updates, originClientId });

            // Update global feed listeners
            this.emit('global-report-update', {
                type: 'stats-update',
                reportId: id,
                updates,
                originClientId
            });
        } else if (type === 'comment') {
            // Update comment listeners (in report detail)
            this.emit(`comment-update:${id}`, { ...updates, originClientId });
        }
        console.log(`[Realtime] Emitted vote update for ${type} ${id}`, updates);
    }

    /**
     * Emit a badge earned event (Personal Notification)
     * @param {string} anonymousId - The recipient
     * @param {object} notification - The FULL notification object from DB
     */
    emitBadgeEarned(anonymousId, notification) {
        this.emit(`user-notification:${anonymousId}`, {
            type: 'achievement',
            notification
        });
        console.log(`[Realtime] Emitted badge earned for ${anonymousId}`, notification.id);
    }

    /**
     * Emit a new user creation event (Global Stats)
     * @param {string} anonymousId
     */
    emitNewUser(anonymousId) {
        this.emit('global-report-update', {
            type: 'new-user',
            anonymousId
        });
        console.log(`[Realtime] Emitted new user creation: ${anonymousId}`);
    }

    /**
     * Emit a report status change (Global Stats)
     * @param {string} reportId
     * @param {string} prevStatus
     * @param {string} newStatus
     * @param {string} [originClientId]
     */
    emitStatusChange(reportId, prevStatus, newStatus, originClientId) {
        this.emit('global-report-update', {
            type: 'status-change',
            reportId,
            prevStatus,
            newStatus,
            originClientId
        });
        console.log(`[Realtime] Emitted status change for ${reportId}: ${prevStatus} -> ${newStatus}`);
    }
}

// Export singleton instance
export const realtimeEvents = new RealtimeEvents();
