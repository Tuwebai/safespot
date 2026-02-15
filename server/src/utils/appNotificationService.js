import { DB } from './db.js';
import logger, { logError } from './logger.js';
import {
    isPushConfigured
} from './webPush.js';
import { NotificationQueue } from '../engine/NotificationQueue.js';

/**
 * NotificationService (INTERNAL APP NOTIFICATIONS)
 * ⚠️ DEUDA TÉCNICA DETECTADA: Este archivo contiene logicamente acoplada 
 * (SSE, Push, DB Operations) y con >700 líneas requiere refactorización modular.
 * Se renombró a AppNotificationService para delegar notificaciones externas al nuevo NotificationService.
 * @arch_status: PENDING_REFACTOR
 */
export const NotificationService = {
    /**
     * Notify users near a new report
     */
    async notifyNearbyNewReport(report) {
        if (!report.latitude || !report.longitude) {
            return;
        }


        logger.debug(`[Notify] Bulk: notifyNearbyNewReport for report ${report.id}`);

        try {
            const db = DB.public();

            // SINGLE BULK OPERATION:
            // 1. Find all recipients (Settings proximity OR User Zones)
            // 2. Generate appropriate titles/messages in SQL
            // 3. Insert into notifications table
            // 4. Update notification_settings counts
            // All within a single database transaction for performance and consistency.

            const result = await db.query(`
                WITH matched_recipients AS (
                    -- General proximity matched from settings
                    SELECT 
                        u.anonymous_id,
                        'system' as alert_type, -- Fixed constraint violation
                        NULL as zone_type,
                        ST_Distance(ns.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distance
                    FROM notification_settings ns
                    JOIN anonymous_users u ON ns.anonymous_id = u.anonymous_id
                    WHERE 
                        ns.proximity_alerts = true
                        AND ns.anonymous_id != $3
                        AND ns.notifications_today < ns.max_notifications_per_day
                        AND ST_DWithin(ns.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, u.interest_radius_meters)
                    
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
                    INSERT INTO notifications (anonymous_id, type, title, message, entity_type, entity_id, report_id, metadata)
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
                        $5,
                        jsonb_build_object(
                            'motive', CASE WHEN alert_type = 'zone' THEN 'proximity' ELSE 'proximity' END,
                            'zone_type', zone_type,
                            'algorithm_version', 'v1',
                            'deep_link', '/reporte/' || $5
                        )
                    FROM unique_recipients
                    RETURNING *
                ),
                updated_settings AS (
                    UPDATE notification_settings
                    SET notifications_today = notifications_today + 1,
                        last_notified_at = NOW()
                    WHERE anonymous_id IN (SELECT anonymous_id FROM inserted_notifications)
                )
                SELECT * FROM inserted_notifications;
            `, [
                report.latitude,
                report.longitude,
                report.anonymous_id,
                report.category || 'un incidente',
                report.id
            ]);

            const notifications = result.rows;
            logger.info(`[Notify] Bulk notification process completed for report ${report.id}. emitted=${notifications.length}`);

            // 5. Enqueue Push Notifications for nearby users (Enterprise Engine)
            if (notifications.length > 0 && isPushConfigured()) {
                // We send it to a specialized background processor if needed, 
                // but for v1 we can enqueue them individually or in a batch job.
                // Let's do one job per recipient for maximum retry granularity.
                for (const n of notifications) {
                    NotificationQueue.enqueue({
                        type: 'REPORT_NEARBY',
                        target: { anonymousId: n.anonymous_id },
                        delivery: { priority: 'high', ttlSeconds: 1800 }, // 30 min TTL
                        payload: {
                            title: n.title,
                            message: n.message,
                            reportId: report.id,
                            data: { type: 'proximity' }
                        }
                    });
                }
            }

            // 6. Emit Real-time Events (SSE)
            if (notifications.length > 0) {
                import('./eventEmitter.js').then(({ realtimeEvents }) => {
                    notifications.forEach(notification => {
                        realtimeEvents.emitUserNotification(notification.anonymous_id, {
                            eventId: notification.id, // ✅ Enterprise: ID determinístico de DB
                            type: 'proximity',
                            notification
                        });
                    });
                }).catch(err => console.error('[Notify] Failed to load eventEmitter', err));
            }

        } catch (err) {
            logError(err, { context: 'notifyNearbyNewReport.bulk', reportId: report.id });
        }
    },

    /**
     * Notify report owner of new activity (comment, share, sighting)
     */
    async notifyActivity(reportId, type, entityId, triggerAnonymousId) {
        logger.debug(`[Notify] Event: notifyActivity type=${type} report=${reportId}`);
        try {
            const db = DB.public();

            // 1. Get report owner and their settings
            const reportResult = await db.query(`
                SELECT r.anonymous_id, r.title, ns.report_activity, ns.notifications_today, ns.max_notifications_per_day
                FROM reports r
                LEFT JOIN notification_settings ns ON ns.anonymous_id = r.anonymous_id
                WHERE r.id = $1
            `, [reportId]);



            if (reportResult.rows.length === 0) {
                return;
            }
            const report = reportResult.rows[0];

            // Don't notify if user triggered own activity or has disabled this type
            if (report.anonymous_id === triggerAnonymousId) {
                // Self-activity skipped silently
                return;
            }
            if (!report.report_activity) {
                // User preference - skipped silently
                return;
            }
            if (report.notifications_today >= report.max_notifications_per_day) {
                // Rate limit - skipped silently
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

            const notification = await this.createNotification({
                anonymous_id: report.anonymous_id,
                type: 'activity',
                title,
                message,
                entity_type: entityType,
                entity_id: entityId, // Original entity (comment_id or report_id for shares)
                report_id: reportId,
                metadata: {
                    motive: 'social',
                    subtype: type, // 'comment', 'sighting', 'share'
                    source_entity_id: entityId,
                    deep_link: `/reporte/${reportId}`
                }
            });
            logger.info(`[Notify] Notification stored for activity ${type} on report ${reportId}`);

            // 4. Enqueue Push Notification (Resilient Background Engine)
            if (isPushConfigured()) {
                await NotificationQueue.enqueue({
                    type: 'ACTIVITY',
                    target: { anonymousId: report.anonymous_id },
                    delivery: { priority: 'normal', ttlSeconds: 7200 }, // 2h TTL
                    payload: {
                        title,
                        message,
                        reportId,
                        entityId
                    }
                });
            }

            // 5. Emit Real-time Event (SSE)
            try {
                const { realtimeEvents } = await import('./eventEmitter.js');
                realtimeEvents.emitUserNotification(report.anonymous_id, {
                    eventId: notification.id, // ✅ Enterprise: ID determinístico de DB
                    type: type,
                    notification // SSOT: Send the full object from DB
                });
            } catch (sseErr) {
                console.error('[Notify] SSE Emit failed:', sseErr);
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
        if (!report.latitude || !report.longitude) {
            return;
        }

        try {
            const db = DB.public();

            // Batch INSERT: Create all notifications in one query
            const result = await db.query(`
                WITH eligible_recipients AS (
                    SELECT ns.anonymous_id
                    FROM notification_settings ns
                    JOIN anonymous_users u ON ns.anonymous_id = u.anonymous_id
                    WHERE 
                        ns.similar_reports = true
                        AND ns.anonymous_id != $2
                        AND ns.notifications_today < ns.max_notifications_per_day
                        AND ST_DWithin(ns.location, ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography, u.interest_radius_meters)
                )
                INSERT INTO notifications (anonymous_id, type, title, message, entity_type, entity_id, report_id)
                SELECT 
                    anonymous_id,
                    'system', -- Fixed constraint violation
                    '📍 Reporte similar cerca tuyo',
                    'Se reportó un nuevo caso de "' || $1::text || '" en tu zona.',
                    'report',
                    $5,
                    $5,
                    jsonb_build_object(
                        'motive', 'similar',
                        'algorithm_version', 'v1',
                        'deep_link', '/reporte/' || $5
                    )
                FROM eligible_recipients
                RETURNING *
            `, [report.category, report.anonymous_id, report.latitude, report.longitude, report.id]);

            const notifications = result.rows;
            const notifiedCount = notifications.length;
            logger.info(`[Notify] Batch created ${notifiedCount} similar report notifications`);

            // Batch UPDATE: Increment notification counts for all recipients
            if (notifiedCount > 0) {
                db.query(`
                    UPDATE notification_settings
                    SET notifications_today = notifications_today + 1,
                    last_notified_at = NOW()
                    WHERE anonymous_id = ANY($1::uuid[])
                `, [notifications.map(r => r.anonymous_id)]).catch(e => console.error('[Notify] Stats update failed', e));

                // Enqueue Push Notifications (Enterprise Engine)
                if (isPushConfigured()) {
                    notifications.forEach(n => {
                        NotificationQueue.enqueue({
                            type: 'REPORT_NEARBY',
                            target: { anonymousId: n.anonymous_id },
                            delivery: { priority: 'high', ttlSeconds: 1800 },
                            payload: {
                                title: n.title,
                                message: n.message,
                                reportId: report.id,
                                data: { type: 'similar' }
                            }
                        });
                    });
                }

                // Emit Real-time Events
                import('./eventEmitter.js').then(({ realtimeEvents }) => {
                    notifications.forEach(notification => {
                        realtimeEvents.emitUserNotification(notification.anonymous_id, {
                            eventId: notification.id, // ✅ Enterprise: ID determinístico de DB
                            type: 'similar',
                            notification
                        });
                    });
                }).catch(err => console.error('[Notify] Failed to load eventEmitter', err));
            }

        } catch (err) {
            logError(err, { context: 'notifySimilarReports', reportId: report.id });
        }
    },

    /**
     * Create the notification record and increment daily count
     */
    async notifyBadgeEarned(anonymousId, badge) {
        if (!badge || !badge.name) {
            return;
        }

        logger.info(`[Notify] Badge Earned: ${badge.name} for ${anonymousId}`);

        try {
            // 1. Insert and get the full notification object (SSOT)
            const notification = await this.createNotification({
                anonymous_id: anonymousId,
                type: 'achievement',
                title: '🏆 ¡Nueva Insignia Desbloqueada!',
                message: `Has ganado la insignia "${badge.name}". ¡Felicitaciones!`,
                entity_type: 'badge',
                entity_id: badge.id || null,
                report_id: null,
                metadata: {
                    motive: 'gamification',
                    subtype: 'badge_earned',
                    deep_link: '/perfil?tab=achievements'
                }
            });

            // 2. Emit Real-time Event (SSE) with strict contract
            try {
                const { realtimeEvents } = await import('./eventEmitter.js');
                realtimeEvents.emitBadgeEarned(anonymousId, notification);
            } catch (sseErr) {
                console.error('[Notify] SSE Emit failed:', sseErr);
            }
        } catch (err) {
            logError(err, { context: 'notifyBadgeEarned', anonymousId, badge: badge.name });
        }
    },

    /**
     * Notify parent comment author of a reply
     */
    async notifyCommentReply(parentCommentId, replyId, triggerAnonymousId) {
        logger.debug(`[Notify] Event: notifyCommentReply parent=${parentCommentId}`);
        try {
            const db = DB.public();

            // 1. Get parent comment owner
            const parentResult = await db.query(`
                SELECT c.anonymous_id, c.report_id, c.content, ns.notifications_today, ns.max_notifications_per_day
                FROM comments c
                LEFT JOIN notification_settings ns ON ns.anonymous_id = c.anonymous_id
                WHERE c.id = $1
            `, [parentCommentId]);

            if (parentResult.rows.length === 0) {
                return;
            }
            const parent = parentResult.rows[0];

            // Don't notify self
            if (parent.anonymous_id === triggerAnonymousId) {
                return;
            }

            // Check limits
            if (parent.notifications_today >= parent.max_notifications_per_day) {
                return;
            }

            // 2. Create Notification
            const notification = await this.createNotification({
                anonymous_id: parent.anonymous_id,
                type: 'activity',
                title: '↩️ Respondieron a tu comentario',
                message: `Alguien respondió a tu comentario en un reporte.`,
                entity_type: 'comment', // The reply
                entity_id: replyId,
                report_id: parent.report_id,
                metadata: {
                    motive: 'social',
                    subtype: 'reply',
                    source_entity_id: replyId,
                    deep_link: `/reporte/${parent.report_id}`
                }
            });
            logger.info(`[Notify] Notification sent to parent comment author ${parent.anonymous_id}`);

            // 3. Enqueue Push Notification (Enterprise Engine)
            if (isPushConfigured()) {
                await NotificationQueue.enqueue({
                    type: 'ACTIVITY',
                    target: { anonymousId: parent.anonymous_id },
                    delivery: { priority: 'normal', ttlSeconds: 7200 },
                    payload: {
                        title: '↩️ Respondieron a tu comentario',
                        message: 'Alguien respondió a tu comentario.',
                        reportId: parent.report_id,
                        entityId: replyId,
                        data: { type: 'reply' }
                    }
                });
            }

            // 4. Emit Real-time Event (SSE)
            try {
                const { realtimeEvents } = await import('./eventEmitter.js');
                realtimeEvents.emitUserNotification(parent.anonymous_id, {
                    eventId: notification.id, // ✅ Enterprise: ID determinístico de DB
                    type: 'reply',
                    notification
                });
            } catch (sseErr) {
                console.error('[Notify] SSE Emit failed:', sseErr);
            }

        } catch (err) {
            logError(err, { context: 'notifyCommentReply', parentCommentId });
        }
    },

    /**
     * Notify user when mentioned in a comment
     */
    async notifyMention(targetAnonymousId, commentId, triggerAnonymousId, reportId) {
        logger.debug(`[Notify] Event: notifyMention target=${targetAnonymousId.substring(0, 8)}...`);
        try {
            const db = DB.public();

            // 1. Get target settings
            const targetResult = await db.query(`
                SELECT ns.notifications_today, ns.max_notifications_per_day
                FROM notification_settings ns
                WHERE ns.anonymous_id = $1
            `, [targetAnonymousId]);

            // If no settings (rare), create default or skip? Let's assume defaults if missing but usually valid users have settings
            const targetSettings = targetResult.rows[0];

            // Skip limits or strict checks? Mentions are high priority, but let's respect daily limit to avoid spam
            if (targetSettings && targetSettings.notifications_today >= targetSettings.max_notifications_per_day) {
                logger.info('[Notify] Skipped Mention: Daily limit reached for target');
                return;
            }

            // 2. Create Notification
            const notification = await this.createNotification({
                anonymous_id: targetAnonymousId,
                type: 'mention', // New type
                title: '⚡ Te han mencionado',
                message: 'Alguien te mencionó en un comentario.',
                entity_type: 'comment',
                entity_id: commentId,
                report_id: reportId,
                metadata: {
                    motive: 'social',
                    subtype: 'mention',
                    source_entity_id: commentId,
                    deep_link: `/reporte/${reportId}`
                }
            });

            // 3. Enqueue Push Notification (Enterprise Engine)
            if (isPushConfigured()) {
                await NotificationQueue.enqueue({
                    type: 'ACTIVITY',
                    target: { anonymousId: targetAnonymousId },
                    delivery: { priority: 'high', ttlSeconds: 7200 }, // Mentions are high priority
                    payload: {
                        title: '⚡ Te han mencionado',
                        message: 'Alguien te mencionó en un comentario.',
                        reportId: reportId,
                        entityId: commentId,
                        data: { type: 'mention' }
                    }
                });
            }

            // 4. Emit Real-time Event (SSE)
            try {
                const { realtimeEvents } = await import('./eventEmitter.js');
                realtimeEvents.emitUserNotification(targetAnonymousId, {
                    eventId: notification.id, // ✅ Enterprise: ID determinístico de DB
                    type: 'mention',
                    notification
                });
            } catch (sseErr) {
                console.error('[Notify] SSE Emit failed:', sseErr);
            }

        } catch (err) {
            logError(err, { context: 'notifyMention', targetAnonymousId, commentId });
        }
    },

    /**
     * Notify author of a like/vote
     */
    async notifyLike(targetType, targetId, triggerAnonymousId) {
        logger.debug(`[Notify] Event: notifyLike type=${targetType}`);
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
            if (ownerResult.rows.length === 0) {
                return;
            }
            const owner = ownerResult.rows[0];

            // Don't notify self
            if (owner.anonymous_id === triggerAnonymousId) {
                return;
            }

            // Check limits
            if (owner.notifications_today >= owner.max_notifications_per_day) {
                return;
            }

            // 2. Create Notification
            const title = targetType === 'report' ? '❤️ A alguien le gustó tu reporte' : '❤️ A alguien le gustó tu comentario';
            const message = targetType === 'report'
                ? `Tu reporte recibe apoyo de la comunidad.`
                : `Tu comentario está siendo útil.`;

            const notification = await this.createNotification({
                anonymous_id: owner.anonymous_id,
                type: 'like', // New type specific for likes
                title,
                message,
                entity_type: targetType,
                entity_id: targetId,
                report_id: owner.report_id,
                metadata: {
                    motive: 'social',
                    subtype: 'like',
                    source_entity_id: targetId,
                    deep_link: targetType === 'report' ? `/reporte/${targetId}` : `/reporte/${owner.report_id}`
                }
            });

            // 3. Enqueue Push Notification (Enterprise Engine)
            if (isPushConfigured()) {
                await NotificationQueue.enqueue({
                    type: 'ACTIVITY',
                    target: { anonymousId: owner.anonymous_id },
                    delivery: { priority: 'normal', ttlSeconds: 7200 },
                    payload: {
                        title,
                        message,
                        reportId: owner.report_id,
                        entityId: targetId,
                        data: { type: 'like' }
                    }
                });
            }

            // 4. Emit Real-time Event (Private User Notification)
            try {
                const { realtimeEvents } = await import('./eventEmitter.js');

                // 4a. Private Notification (to owner)
                realtimeEvents.emitUserNotification(owner.anonymous_id, {
                    eventId: notification.id, // ✅ Enterprise: ID determinístico de DB
                    type: 'like',
                    notification,
                    targetType,
                    targetId,
                    reportId: owner.report_id
                });

                // 4b. Public Broadcast (REMOVED: Handled on-site by action routes to avoid duplication)
                /*
                if (targetType === 'report') {
                    ...
                }
                */

            } catch (sseErr) {
                console.error('[Notify] SSE Emit failed:', sseErr);
            }

        } catch (err) {
            logError(err, { context: 'notifyLike', targetType, targetId });
        }
    },

    /**
     * Create the notification record and increment daily count
     */
    /**
     * Create the notification record and increment daily count
     * @returns {Promise<object>} The full notification object from DB
     */
    async createNotification({ anonymous_id, type, title, message, entity_type, entity_id, report_id, metadata }) {
        const db = DB.public();

        // 1. Insert notification and return it
        const result = await db.query(`
                INSERT INTO notifications (anonymous_id, type, title, message, entity_type, entity_id, report_id, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [anonymous_id, type, title, message, entity_type, entity_id, report_id, metadata || null]);

        // 2. Increment count in settings (fire and forget / parallel)
        db.query(`
                UPDATE notification_settings 
                SET notifications_today = notifications_today + 1,
                last_notified_at = NOW()
                WHERE anonymous_id = $1
            `, [anonymous_id]).catch(err => console.error('[Notify] Failed to update stats:', err));

        return result.rows[0];
    },

    /**
     * Notify user of a new follower
     */
    async notifyNewFollower(followerId, followedId) {
        logger.debug(`[Notify] Event: notifyNewFollower`);
        try {
            const db = DB.public();

            // 1. Get follower details (alias) and target settings
            const followerResult = await db.query(`
                SELECT alias FROM anonymous_users WHERE anonymous_id = $1
            `, [followerId]);

            const targetResult = await db.query(`
                SELECT ns.notifications_today, ns.max_notifications_per_day 
                FROM notification_settings ns 
                WHERE ns.anonymous_id = $1
            `, [followedId]);

            const followerAlias = followerResult.rows[0]?.alias || 'Alguien';

            // Check limits
            const targetSettings = targetResult.rows[0];
            if (targetSettings && targetSettings.notifications_today >= targetSettings.max_notifications_per_day) {
                logger.debug(`[Notify] Daily limit reached (${targetSettings.notifications_today}/${targetSettings.max_notifications_per_day})`);
            }

            // 2. Create Notification
            const notification = await this.createNotification({
                anonymous_id: followedId,
                type: 'follow',
                title: '👤 Tienes un nuevo seguidor',
                message: `"${followerAlias}" comenzó a seguirte.`,
                entity_type: 'user',
                entity_id: followerId, // 🧠 SSOT: entity_id is the FOLLOWER (to visit their profile)
                report_id: null,
                metadata: {
                    motive: 'social',
                    subtype: 'follow',
                    source_entity_id: followerId,
                    deep_link: `/usuario/${followerId}`
                }
            });

            // 3. Enqueue Push Notification (Enterprise Engine)
            if (isPushConfigured()) {
                await NotificationQueue.enqueue({
                    type: 'ACTIVITY',
                    target: { anonymousId: followedId },
                    delivery: { priority: 'normal', ttlSeconds: 7200 },
                    payload: {
                        title: '👤 Tienes un nuevo seguidor',
                        message: `"${followerAlias}" comenzó a seguirte.`,
                        reportId: null,
                        entityId: followerId, // 🧠 Corrected: follower is the entity to visit
                        data: {
                            type: 'follow',
                            followerId,
                            followerAlias,
                            deepLink: `/usuario/${followerId}` // 🚀 SSOT Deep Link
                        }
                    }
                });
            }

            // 4. Emit Real-time Event (SSE)
            try {
                const { realtimeEvents } = await import('./eventEmitter.js');
                realtimeEvents.emitUserNotification(followedId, {
                    eventId: notification.id, // ✅ Enterprise: ID determinístico de DB
                    type: 'follow',
                    notification,
                    followerId,
                    followerAlias
                });
            } catch (sseErr) {
                console.error('[Notify] SSE Emit failed:', sseErr);
            }

        } catch (err) {
            logError(err, { context: 'notifyNewFollower', followerId, followedId });
        }
    }
};
