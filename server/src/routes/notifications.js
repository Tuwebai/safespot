import express from 'express';
import { requireAnonymousId } from '../utils/validation.js';
import { queryWithRLS } from '../utils/rls.js';
import { logError } from '../utils/logger.js';
import { DB } from '../utils/db.js';

// Router triggers restart
const router = express.Router();

/**
 * GET /api/notifications
 * Fetch user's notifications
 */
router.get('/', requireAnonymousId, async (req, res) => {
    try {
        const anonymousId = req.anonymousId;
        console.log(`[Notifications Settings] GET received for ${anonymousId}`);
        const db = DB.withContext(anonymousId);

        const notifications = await db.select('notifications', {
            where: { anonymous_id: anonymousId },
            orderBy: ['created_at', 'DESC'],
            limit: 50
        });

        res.json({ success: true, data: notifications });
    } catch (error) {
        logError(error, req);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read
 */
router.patch('/:id/read', requireAnonymousId, async (req, res) => {
    try {
        const { id } = req.params;
        const anonymousId = req.anonymousId;
        const db = DB.withContext(anonymousId);

        await db.update('notifications', { is_read: true }, { id, anonymous_id: anonymousId });

        res.json({ success: true });
    } catch (error) {
        logError(error, req);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read
 */
router.patch('/read-all', requireAnonymousId, async (req, res) => {
    try {
        const anonymousId = req.anonymousId;
        const db = DB.withContext(anonymousId);

        await db.query(`
            UPDATE notifications 
            SET is_read = true 
            WHERE anonymous_id = $1 AND is_read = false
        `, [anonymousId]);

        res.json({ success: true });
    } catch (error) {
        logError(error, req);
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
});

/**
 * GET /api/notifications/settings
 * Fetch user's notification settings
 */
router.get('/settings', requireAnonymousId, async (req, res) => {
    try {
        const anonymousId = req.anonymousId;
        const db = DB.withContext(anonymousId);

        let settings = await db.select('notification_settings', {
            where: { anonymous_id: anonymousId },
            single: true
        });

        // If no settings exist, create default ones
        if (!settings) {
            // Ensure anonymous user exists first to satisfy FK
            await db.query(`
                INSERT INTO anonymous_users (anonymous_id) VALUES ($1) ON CONFLICT DO NOTHING
            `, [anonymousId]);

            settings = await db.insert('notification_settings', {
                anonymous_id: anonymousId,
                proximity_alerts: false,
                report_activity: false,
                similar_reports: false,
                radius_meters: 1000,
                max_notifications_per_day: 5
            });
        }

        console.log(`[Notifications Settings] Returning settings for ${anonymousId}:`, settings);
        res.json({ success: true, data: settings });
    } catch (error) {
        logError(error, req);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

/**
 * PATCH /api/notifications/settings
 * Update user's notification settings and location
 */
router.patch('/settings', requireAnonymousId, async (req, res) => {
    try {
        const anonymousId = req.anonymousId;
        const db = DB.withContext(anonymousId);
        const {
            proximity_alerts,
            report_activity,
            similar_reports,
            radius_meters,
            max_notifications_per_day,
            lat,
            lng,
            city,
            province
        } = req.body;

        console.log(`[Notifications Settings] PATCH received for ${anonymousId}`, req.body);

        const updates = {};
        if (proximity_alerts !== undefined) updates.proximity_alerts = proximity_alerts;
        if (report_activity !== undefined) updates.report_activity = report_activity;
        if (similar_reports !== undefined) updates.similar_reports = similar_reports;
        if (radius_meters !== undefined) updates.radius_meters = radius_meters;
        if (max_notifications_per_day !== undefined) updates.max_notifications_per_day = max_notifications_per_day;
        if (lat !== undefined) updates.last_known_lat = lat;
        if (lng !== undefined) updates.last_known_lng = lng;
        if (city !== undefined) updates.last_known_city = city;
        if (province !== undefined) updates.last_known_province = province;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        // Ensure anonymous user exists first to satisfy FK
        await db.query(`
            INSERT INTO anonymous_users (anonymous_id) VALUES ($1) ON CONFLICT DO NOTHING
        `, [anonymousId]);

        const result = await db.query(`
            INSERT INTO notification_settings (anonymous_id, ${Object.keys(updates).join(', ')})
            VALUES ($1, ${Object.values(updates).map((_, i) => `$${i + 2}`).join(', ')})
            ON CONFLICT (anonymous_id) DO UPDATE SET
                ${Object.keys(updates).map(k => `${k} = EXCLUDED.${k}`).join(', ')},
                updated_at = NOW()
            RETURNING *
        `, [anonymousId, ...Object.values(updates)]);

        console.log(`[Notifications Settings] Saved successfully for ${anonymousId}`);
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        logError(error, req);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

export default router;
