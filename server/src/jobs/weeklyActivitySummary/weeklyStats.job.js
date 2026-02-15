
import { WeeklyStatsService } from './weeklyStats.service.js'; // Local import
import { NotificationService } from '../../utils/appNotificationService.js';
import { logSuccess, logError } from '../../utils/logger.js';
import { NotificationQueue } from '../../engine/NotificationQueue.js';
import { DB } from '../../utils/db.js';

/**
 * Weekly Activity Digest Job (JS)
 * 
 * Frequency: Weekly (e.g., Monday 09:00 AM)
 * Responsibility: 
 * 1. Identify active zones.
 * 2. Calculate stats per zone.
 * 3. Fan-out notifications to subscribed users.
 * 4. Ensure Idempotency.
 */
export const WeeklyActivityDigestJob = {

    async run() {
        console.log('[WeeklyDigest] Starting weekly digest job...');
        
        // 0. Define Time Window (Previous Monday to this Sunday)
        const now = new Date();
        // Adjust to be "Last Week"
        // For testing/dev, let's assume we run this for "Last 7 days"
        const endDate = new Date(now);
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        
        try {
            // 1. Get Active Zones
            const activeZones = await WeeklyStatsService.getActiveZones(startDate, endDate);
            console.log(`[WeeklyDigest] Found ${activeZones.length} active zones.`);

            for (const zoneName of activeZones) {
                await this.processZone(zoneName, startDate, endDate);
            }

            logSuccess('[WeeklyDigest] Job completed successfully.');

        } catch (error) {
            logError(error, { context: 'WeeklyActivityDigestJob' });
        }
    },

    async processZone(zoneName, startDate, endDate) {
        try {
            // 2. Calculate Stats
            const stats = await WeeklyStatsService.getZoneStats(zoneName, startDate, endDate);
            
            if (stats.totalReceived < 3) {
                // Low activity heuristic
            }

            // 3. Find Recipients
            const recipients = await WeeklyStatsService.getSubscribedUsers(zoneName);
            console.log(`[WeeklyDigest] Zone ${zoneName}: ${recipients.length} recipients found.`);

            // 4. Send Notifications (Batching done inside simple loop for v1)
            for (const recipient of recipients) {
                await this.sendDigest(recipient.anonymous_id, stats, zoneName);
            }

        } catch (error) {
            logError(error, { context: 'WeeklyActivityDigestJob.processZone', zone: zoneName });
        }
    },

    async sendDigest(anonymousId, stats, zoneName) {
        // Idempotency Check
        const db = DB.public();
        const existing = await db.query(`
            SELECT 1 FROM notifications 
            WHERE anonymous_id = $1 
            AND type = 'weekly_digest' 
            AND created_at > NOW() - INTERVAL '6 days' -- Weekly check
            LIMIT 1
        `, [anonymousId]);

        if (existing.rows.length > 0) {
            return; 
        }

        // Construct Message
        const diffText = stats.diffPercent > 0 
            ? `📈 +${stats.diffPercent}% actividad`
            : stats.diffPercent < 0 
                ? `📉 ${stats.diffPercent}% menos incidentes`
                : '📊 Actividad estable';
        
        const topCatText = stats.topCategory ? `• Principal: ${stats.topCategory}` : '';

        // Create Notification
        const notification = await NotificationService.createNotification({
            anonymous_id: anonymousId,
            type: 'weekly_digest',
            title: `Resumen Semanal: ${zoneName}`,
            message: `Esta semana hubo ${stats.totalReceived} reportes. ${diffText}. ${topCatText}`,
            entity_type: 'stats',
            entity_id: null,
            report_id: null
        });

        // Enqueue Push
        await NotificationQueue.enqueue({
            type: 'WEEKLY_DIGEST', // New type
            target: { anonymousId },
            delivery: { priority: 'normal', ttlSeconds: 3600 * 24 }, // 24h TTL
            payload: {
                title: notification.title,
                message: notification.message,
                data: {
                    type: 'weekly_digest',
                    zoneId: zoneName,
                    url: `/weekly-summary?zone=${encodeURIComponent(zoneName)}`
                }
            }
        });
    }
};
