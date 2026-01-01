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

        console.log(`[Notify] Bulk Event: notifyNearbyNewReport for report ${report.id}`);

        try {
            const db = DB.public();

            // SINGLE BULK OPERATION:
            // 1. Find all recipients (Settings proximity OR User Zones)
            // 2. Generate appropriate titles/messages in SQL
            // 3. Insert into notifications table
            // 4. Update notification_settings counts
            // All within a single database transaction for performance and consistency.

            await db.query(`
                WITH matched_recipients AS (
                    -- General proximity matched from settings
                    SELECT 
                        ns.anonymous_id,
                        'proximity' as alert_type,
                        NULL as zone_type,
                        ST_Distance(ns.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distance
                    FROM notification_settings ns
                    WHERE 
                        ns.proximity_alerts = true
                        AND ns.anonymous_id != $3
                        AND ns.notifications_today < ns.max_notifications_per_day
                        AND ST_DWithin(ns.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, ns.radius_meters)
                    
                    UNION ALL
                    
                    -- Priority zone matches
                    SELECT 
                        uz.anonymous_id,
                        'zone' as alert_type,
                        uz.type as zone_type,
                        ST_Distance(uz.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distance
                    FROM user_zones uz
                    JOIN notification_settings ns ON ns.anonymous_id = uz.anonymous_id
                    WHERE 
                        uz.anonymous_id != $3
                        AND ns.notifications_today < ns.max_notifications_per_day
                        AND ST_DWithin(uz.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, uz.radius_meters)
                ),
                unique_recipients AS (
                    SELECT DISTINCT ON (anonymous_id) 
                        anonymous_id, alert_type, zone_type, distance
                    FROM matched_recipients
                    ORDER BY anonymous_id, 
                             CASE 
                                WHEN zone_type = 'home' THEN 1
                                WHEN zone_type = 'work' THEN 2
                                WHEN zone_type = 'frequent' THEN 3
                                ELSE 4
                             END ASC
                ),
                inserted_notifications AS (
                    INSERT INTO notifications (anonymous_id, type, title, message, entity_type, entity_id, report_id)
                    SELECT 
                        anonymous_id,
                        alert_type,
                        CASE 
                            WHEN alert_type = 'zone' THEN 
                                CASE 
                                    WHEN zone_type = 'home' THEN '🏠 Reporte cerca de tu Casa'
                                    WHEN zone_type = 'work' THEN '💼 Reporte cerca de tu Trabajo'
                                    WHEN zone_type = 'frequent' THEN '📍 Reporte en tu zona frecuente'
                                    ELSE '⚠️ Reporte en tu zona configurada'
                                END
                            ELSE '⚠️ Nuevo reporte cerca tuyo'
                        END as title,
                        'Se reportó ' || $4 || ' a ' || 
                        CASE 
                            WHEN distance < 1000 THEN ROUND(distance::numeric)::text || 'm'
                            ELSE ROUND((distance/1000)::numeric, 1)::text || 'km'
                        END || '.' as message,
                        'report',
                        $5,
                        $5
                    FROM unique_recipients
                    RETURNING anonymous_id
                )
                UPDATE notification_settings
                SET notifications_today = notifications_today + 1,
                    last_notified_at = NOW()
                WHERE anonymous_id IN (SELECT anonymous_id FROM inserted_notifications);
            `, [
                report.latitude,
                report.longitude,
                report.anonymous_id,
                report.category || 'un incidente',
                report.id
            ]);

            console.log(`[Notify] Bulk notification process completed for report ${report.id}`);
        } catch (err) {
            logError(err, { context: 'notifyNearbyNewReport.bulk', reportId: report.id });
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
                entity_id: entityId, // Original entity (comment_id or report_id for shares)
                report_id: reportId
            });
        } catch (err) {
            logError(err, { context: 'notifyActivity', reportId, type });
        }
    },

    /**
     * Notify users of similar reports in their zone
     * OPTIMIZED: Uses batch INSERT for all recipients in a single query
     */
    async notifySimilarReports(report) {
        if (!report.latitude || !report.longitude) return;

        try {
            const db = DB.public();

            // Batch INSERT: Create all notifications in one query
            const result = await db.query(`
                WITH eligible_recipients AS (
                    SELECT ns.anonymous_id
                    FROM notification_settings ns
                    WHERE 
                        ns.similar_reports = true
                        AND ns.anonymous_id != $2
                        AND ns.notifications_today < ns.max_notifications_per_day
                        AND (ns.categories_of_interest IS NULL OR $1::text = ANY(ns.categories_of_interest))
                        AND ST_DWithin(ns.location, ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography, 2000)
                )
                INSERT INTO notifications (anonymous_id, type, title, message, entity_type, entity_id, report_id)
                SELECT 
                    anonymous_id,
                    'similar',
                    '📍 Reporte similar cerca tuyo',
                    'Se reportó un nuevo caso de "' || $1::text || '" en tu zona.',
                    'report',
                    $5,
                    $5
                FROM eligible_recipients
                RETURNING anonymous_id
            `, [report.category, report.anonymous_id, report.latitude, report.longitude, report.id]);

            const notifiedCount = result.rows.length;
            console.log(`[Notify] Batch created ${notifiedCount} similar report notifications`);

            // Batch UPDATE: Increment notification counts for all recipients
            if (notifiedCount > 0) {
                await db.query(`
                    UPDATE notification_settings
                    SET notifications_today = notifications_today + 1,
                        last_notified_at = NOW()
                    WHERE anonymous_id = ANY($1::uuid[])
                `, [result.rows.map(r => r.anonymous_id)]);
            }
        } catch (err) {
            logError(err, { context: 'notifySimilarReports', reportId: report.id });
        }
    },

    /**
     * Create the notification record and increment daily count
     */
    async notifyBadgeEarned(anonymousId, badge) {
        if (!badge || !badge.name) return;

        console.log(`[Notify] Badge Earned: ${badge.name} for ${anonymousId}`);

        try {
            await this.createNotification({
                anonymous_id: anonymousId,
                type: 'achievement',
                title: '🏆 ¡Nueva Insignia Desbloqueada!',
                message: `Has ganado la insignia "${badge.name}". ¡Felicitaciones!`,
                entity_type: 'badge',
                entity_id: badge.code || 'badge', // Use code as entity_id if id not available
                report_id: null
            });
        } catch (err) {
            logError(err, { context: 'notifyBadgeEarned', anonymousId, badge: badge.name });
        }
    },

    /**
     * Create the notification record and increment daily count
     * ... existing createNotification ...
     */
    async createNotification({ anonymous_id, type, title, message, entity_type, entity_id, report_id }) {
        const db = DB.public();
        // Insert notification
        await db.query(`
                INSERT INTO notifications (anonymous_id, type, title, message, entity_type, entity_id, report_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [anonymous_id, type, title, message, entity_type, entity_id, report_id]);

        // Increment count in settings
        await db.query(`
                UPDATE notification_settings 
                SET notifications_today = notifications_today + 1,
                    last_notified_at = NOW()
                WHERE anonymous_id = $1
            `, [anonymous_id]);
    }
};
