import { DB } from './db.js';
import { logError } from './logger.js';

/**
 * NotificationService
 * Handles the logic for creating and sending in-app notifications.
 */
export const NotificationService = {
    /**
     * Notify users near a new report
     */
    async notifyNearbyNewReport(report) {
        if (!report.latitude || !report.longitude) return;

        console.log(`[Notify] Event: notifyNearbyNewReport for report ${report.id}`);

        try {
            const db = DB.public();
            const recipients = await db.query(`
                SELECT 
                    ns.anonymous_id,
                    ST_Distance(ns.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distance
                FROM notification_settings ns
                WHERE 
                    ns.proximity_alerts = true
                    AND ns.anonymous_id != $3
                    AND ns.notifications_today < ns.max_notifications_per_day
                    AND ST_DWithin(ns.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, ns.radius_meters)
            `, [report.latitude, report.longitude, report.anonymous_id]);

            console.log(`[Notify] Found ${recipients.rows.length} recipients for proximity alert`);

            for (const recipient of recipients.rows) {
                const distanceStr = recipient.distance < 1000
                    ? `${Math.round(recipient.distance)}m`
                    : `${(recipient.distance / 1000).toFixed(1)}km`;

                await this.createNotification({
                    anonymous_id: recipient.anonymous_id,
                    type: 'proximity',
                    title: '⚠️ Nuevo reporte cerca tuyo',
                    message: `Se reportó ${report.category} a ${distanceStr}.`,
                    entity_type: 'report',
                    entity_id: report.id
                });
            }
        } catch (err) {
            logError(err, { context: 'notifyNearbyNewReport', reportId: report.id });
        }
    },

    /**
     * Notify report owner of new activity (comment, share, sighting)
     */
    async notifyActivity(reportId, type, entityId, triggerAnonymousId) {
        console.log(`[Notify] Event: notifyActivity type=${type} report=${reportId}`);
        try {
            const db = DB.public();

            // 1. Get report owner and their settings
            const reportResult = await db.query(`
                SELECT r.anonymous_id, r.title, ns.report_activity, ns.notifications_today, ns.max_notifications_per_day
                FROM reports r
                LEFT JOIN notification_settings ns ON ns.anonymous_id = r.anonymous_id
                WHERE r.id = $1
            `, [reportId]);

            if (reportResult.rows.length === 0) return;
            const report = reportResult.rows[0];

            // Don't notify if user triggered own activity or has disabled this type
            if (report.anonymous_id === triggerAnonymousId) {
                console.log('[Notify] Skipped: Self-activity');
                return;
            }
            if (!report.report_activity) {
                console.log('[Notify] Skipped: report_activity disabled by user');
                return;
            }
            if (report.notifications_today >= report.max_notifications_per_day) {
                console.log('[Notify] Skipped: Daily limit reached');
                return;
            }

            // 2. Determine title/message
            let title = '';
            let message = '';
            let entityType = '';

            switch (type) {
                case 'comment':
                    title = '💬 Alguien comentó tu reporte';
                    message = `Nuevo comentario en "${report.title}".`;
                    entityType = 'comment';
                    break;
                case 'sighting':
                    title = '👀 Nuevo avistamiento';
                    message = `Alguien aportó un dato sobre "${report.title}".`;
                    entityType = 'sighting';
                    break;
                case 'share':
                    title = '📈 Tu reporte se está compartiendo';
                    message = `Alguien compartió "${report.title}" en redes.`;
                    entityType = 'share';
                    break;
            }

            // 3. Check for similar recent notification to group/prevent spam
            const recent = await db.query(`
                SELECT id FROM notifications 
                WHERE anonymous_id = $1 AND type = 'activity' AND entity_id = $2 
                  AND created_at > NOW() - INTERVAL '1 hour'
                LIMIT 1
            `, [report.anonymous_id, reportId]);

            if (recent.rows.length > 0 && type !== 'sighting') return; // Group shares/comments

            await this.createNotification({
                anonymous_id: report.anonymous_id,
                type: 'activity',
                title,
                message,
                entity_type: entityType,
                entity_id: entityId // Original entity (comment_id or report_id for shares)
            });
        } catch (err) {
            logError(err, { context: 'notifyActivity', reportId, type });
        }
    },

    /**
     * Notify users of similar reports in their zone
     */
    async notifySimilarReports(report) {
        if (!report.latitude || !report.longitude) return;

        try {
            const db = DB.public();
            const recipients = await db.query(`
                SELECT ns.anonymous_id
                FROM notification_settings ns
                WHERE 
                    ns.similar_reports = true
                    AND ns.anonymous_id != $2
                    AND ns.notifications_today < ns.max_notifications_per_day
                    AND ST_DWithin(ns.location, ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography, 2000) -- Tight 2km radius for "nearby"
            `, [report.category, report.anonymous_id, report.latitude, report.longitude]);

            console.log(`[Notify] Found ${recipients.rows.length} recipients for similar reports`);

            for (const recipient of recipients.rows) {
                await this.createNotification({
                    anonymous_id: recipient.anonymous_id,
                    type: 'similar',
                    title: '📍 Reporte similar cerca tuyo',
                    message: `Se reportó un nuevo caso de "${report.category}" en tu zona.`,
                    entity_type: 'report',
                    entity_id: report.id
                });
            }
        } catch (err) {
            logError(err, { context: 'notifySimilarReports', reportId: report.id });
        }
    },

    /**
     * Create the notification record and increment daily count
     */
    async createNotification({ anonymous_id, type, title, message, entity_type, entity_id }) {
        const db = DB.public();
        try {
            await db.query('BEGIN');

            // Insert notification
            await db.query(`
                INSERT INTO notifications (anonymous_id, type, title, message, entity_type, entity_id)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [anonymous_id, type, title, message, entity_type, entity_id]);

            // Increment count in settings
            await db.query(`
                UPDATE notification_settings 
                SET notifications_today = notifications_today + 1,
                    last_notified_at = NOW()
                WHERE anonymous_id = $1
            `, [anonymous_id]);

            await db.query('COMMIT');
        } catch (err) {
            await db.query('ROLLBACK');
            throw err;
        }
    }
};
