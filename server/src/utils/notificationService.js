import { DB } from './db.js';
import { logError } from './logger.js';
import { NOTIFICATIONS } from '../config/constants.js';
import {
    sendPushNotification,
    createActivityNotificationPayload,
    isPushConfigured
} from './webPush.js';

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
            // const recent = await db.query(`
            //     SELECT id FROM notifications 
            //     WHERE anonymous_id = $1 AND type = 'activity' AND entity_id = $2 
            //       AND created_at > NOW() - INTERVAL '1 hour'
            //     LIMIT 1
            // `, [report.anonymous_id, reportId]);

            // if (recent.rows.length > 0 && type !== 'sighting') return; // Group shares/comments

            await this.createNotification({
                anonymous_id: report.anonymous_id,
                type: 'activity',
                title,
                message,
                entity_type: entityType,
                entity_id: entityId, // Original entity (comment_id or report_id for shares)
                report_id: reportId
            });
            console.log(`[Notify] Notification stored for activity ${type} on report ${reportId}`);

            // 4. Send Push Notification
            if (isPushConfigured()) {
                const subscriptionsResult = await db.query(`
                    SELECT * FROM push_subscriptions 
                    WHERE anonymous_id = $1 AND is_active = true
                `, [report.anonymous_id]);

                if (subscriptionsResult.rows.length > 0) {
                    const payload = createActivityNotificationPayload({
                        type: type, // 'comment', 'sighting', 'share'
                        title: title,
                        message: message,
                        reportId: reportId,
                        entityId: entityId
                    });

                    // Send to all active subscriptions of user
                    for (const sub of subscriptionsResult.rows) {
                        sendPushNotification(
                            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                            payload
                        ).catch(err => console.error('[Notify] Push failed:', err.message));
                    }
                }
            }
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
                        AND ST_DWithin(ns.location, ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography, ${NOTIFICATIONS.SIMILAR_REPORTS_RADIUS_METERS})
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
     * Notify parent comment author of a reply
     */
    async notifyCommentReply(parentCommentId, replyId, triggerAnonymousId) {
        console.log(`[Notify] Event: notifyCommentReply parent=${parentCommentId} reply=${replyId}`);
        try {
            const db = DB.public();

            // 1. Get parent comment owner
            const parentResult = await db.query(`
                SELECT c.anonymous_id, c.report_id, c.content, ns.notifications_today, ns.max_notifications_per_day
                FROM comments c
                LEFT JOIN notification_settings ns ON ns.anonymous_id = c.anonymous_id
                WHERE c.id = $1
            `, [parentCommentId]);

            if (parentResult.rows.length === 0) return;
            const parent = parentResult.rows[0];

            // Don't notify self
            if (parent.anonymous_id === triggerAnonymousId) return;

            // Check limits
            if (parent.notifications_today >= parent.max_notifications_per_day) return;

            // 2. Create Notification
            await this.createNotification({
                anonymous_id: parent.anonymous_id,
                type: 'activity',
                title: '↩️ Respondieron a tu comentario',
                message: `Alguien respondió a tu comentario en un reporte.`,
                entity_type: 'comment', // The reply
                entity_id: replyId,
                report_id: parent.report_id
            });
            console.log(`[Notify] Notification sent to parent comment author ${parent.anonymous_id}`);

            // 3. Send Push Notification
            if (isPushConfigured()) {
                const subscriptionsResult = await db.query(`
                    SELECT * FROM push_subscriptions 
                    WHERE anonymous_id = $1 AND is_active = true
                `, [parent.anonymous_id]);

                if (subscriptionsResult.rows.length > 0) {
                    const payload = createActivityNotificationPayload({
                        type: 'reply',
                        title: '↩️ Nuevo comentario',
                        message: 'Alguien respondió a tu comentario.',
                        reportId: parent.report_id,
                        entityId: replyId
                    });

                    // Send to all active subscriptions of user
                    for (const sub of subscriptionsResult.rows) {
                        sendPushNotification(
                            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                            payload
                        ).catch(err => console.error('[Notify] Push failed:', err.message));
                    }
                }
            }

        } catch (err) {
            logError(err, { context: 'notifyCommentReply', parentCommentId });
        }
    },

    /**
     * Notify author of a like/vote
     */
    async notifyLike(targetType, targetId, triggerAnonymousId) {
        console.log(`[Notify] Event: notifyLike type=${targetType} id=${targetId}`);
        try {
            const db = DB.public();
            let ownerQuery = '';

            if (targetType === 'report') {
                ownerQuery = `
                    SELECT r.anonymous_id, r.title as content, ns.notifications_today, ns.max_notifications_per_day, r.id as report_id
                    FROM reports r
                    LEFT JOIN notification_settings ns ON ns.anonymous_id = r.anonymous_id
                    WHERE r.id = $1
                `;
            } else {
                ownerQuery = `
                    SELECT c.anonymous_id, c.content, ns.notifications_today, ns.max_notifications_per_day, c.report_id
                    FROM comments c
                    LEFT JOIN notification_settings ns ON ns.anonymous_id = c.anonymous_id
                    WHERE c.id = $1
                `;
            }

            const ownerResult = await db.query(ownerQuery, [targetId]);
            if (ownerResult.rows.length === 0) return;
            const owner = ownerResult.rows[0];

            // Don't notify self
            if (owner.anonymous_id === triggerAnonymousId) return;

            // Check limits
            if (owner.notifications_today >= owner.max_notifications_per_day) return;

            // Prevent Spam: limit 1 "like" notification per entity per hour
            // const recent = await db.query(`
            //     SELECT id FROM notifications 
            //     WHERE anonymous_id = $1 AND type = 'like' AND entity_id = $2 
            //       AND created_at > NOW() - INTERVAL '1 hour'
            //     LIMIT 1
            // `, [owner.anonymous_id, targetId]);

            // if (recent.rows.length > 0) return;

            // 2. Create Notification
            const title = targetType === 'report' ? '❤️ A alguien le gustó tu reporte' : '❤️ A alguien le gustó tu comentario';
            const message = targetType === 'report'
                ? `Tu reporte recibe apoyo de la comunidad.`
                : `Tu comentario está siendo útil.`;

            await this.createNotification({
                anonymous_id: owner.anonymous_id,
                type: 'like', // New type specific for likes
                title,
                message,
                entity_type: targetType,
                entity_id: targetId,
                report_id: owner.report_id
            });

            // 3. Send Push Notification
            if (isPushConfigured()) {
                const subscriptionsResult = await db.query(`
                    SELECT * FROM push_subscriptions 
                    WHERE anonymous_id = $1 AND is_active = true
                `, [owner.anonymous_id]);

                if (subscriptionsResult.rows.length > 0) {
                    const payload = createActivityNotificationPayload({
                        type: 'like',
                        title: title,
                        message: message,
                        reportId: owner.report_id,
                        entityId: targetId
                    });

                    for (const sub of subscriptionsResult.rows) {
                        sendPushNotification(
                            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                            payload
                        ).catch(err => console.error('[Notify] Push failed:', err.message));
                    }
                }
            }

        } catch (err) {
            logError(err, { context: 'notifyLike', targetType, targetId });
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
