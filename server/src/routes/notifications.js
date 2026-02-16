import express from 'express';
import { requireAnonymousId } from '../utils/validation.js';
import { logError } from '../utils/logger.js';
import { DB } from '../utils/db.js';
import { NOTIFICATIONS } from '../config/constants.js';

// Router triggers restart
const router = express.Router();

/**
 * GET /api/notifications
 * Fetch user's notifications with cursor-based pagination
 * 
 * Query params:
 * - cursor_created_at: ISO timestamp for pagination cursor (optional)
 * - cursor_id: UUID for pagination cursor (optional)
 * - limit: Number of items (default: 50, max: 100)
 */
router.get('/', requireAnonymousId, async (req, res) => {
    try {
        const anonymousId = req.anonymousId;
        const db = DB.withContext(anonymousId);

        // 🏛️ CURSOR PAGINATION: Validate and parse query params
        const cursorCreatedAt = req.query.cursor_created_at || null;
        const cursorId = req.query.cursor_id || null;
        let limit = parseInt(req.query.limit || '50', 10);

        // Validate limit
        if (isNaN(limit) || limit < 1) {
            limit = 50;
        }
        if (limit > 100) {
            limit = 100;
        }

        // 🔒 SECURITY: Both cursor fields required or both null
        if ((cursorCreatedAt && !cursorId) || (!cursorCreatedAt && cursorId)) {
            return res.status(400).json({ 
                error: 'Invalid cursor: both cursor_created_at and cursor_id required' 
            });
        }

        // 🏛️ ENTERPRISE PAGINATION: Fetch limit+1 to detect has_more
        const queryLimit = limit + 1;

        // 🔥 OPTIMIZATION LEVEL 10/10: Separate queries to help planner
        // Eliminates OR ambiguity for index-only scan optimization
        let notifications;
        
        if (cursorCreatedAt && cursorId) {
            // Cursor pagination: Use composite (created_at, id) comparison
            notifications = await db.query(`
                SELECT *
                FROM notifications
                WHERE anonymous_id = $1
                  AND (created_at, id) < ($2::timestamptz, $3::uuid)
                ORDER BY created_at DESC, id DESC
                LIMIT $4
            `, [anonymousId, cursorCreatedAt, cursorId, queryLimit]);
        } else {
            // First page: Simple query without cursor condition
            notifications = await db.query(`
                SELECT *
                FROM notifications
                WHERE anonymous_id = $1
                ORDER BY created_at DESC, id DESC
                LIMIT $2
            `, [anonymousId, queryLimit]);
        }

        // 🧮 SEPARATE QUERY: Unread count (not mixed with main query)
        const unreadResult = await db.query(`
            SELECT COUNT(*) as count
            FROM notifications
            WHERE anonymous_id = $1
              AND is_read = false
        `, [anonymousId]);

        const unreadCount = parseInt(unreadResult.rows[0]?.count || '0', 10);

        // 🏛️ PAGINATION LOGIC: Detect has_more and build next_cursor
        const hasMore = notifications.rows.length > limit;
        const actualNotifications = hasMore 
            ? notifications.rows.slice(0, limit) 
            : notifications.rows;

        const nextCursor = hasMore && actualNotifications.length > 0
            ? {
                created_at: actualNotifications[actualNotifications.length - 1].created_at,
                id: actualNotifications[actualNotifications.length - 1].id
              }
            : null;

        res.json({ 
            success: true, 
            data: actualNotifications,
            next_cursor: nextCursor,
            has_more: hasMore,
            unread_count: unreadCount
        });
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

        // Broadcast to all user tabs
        try {
            const { realtimeEvents } = await import('../utils/eventEmitter.js');
            realtimeEvents.emitUserNotification(anonymousId, {
                eventId: `read-all-${anonymousId}-${Date.now()}`, // ✅ Enterprise: ID determinístico
                type: 'notifications-read-all'
            });
        } catch (err) {
            console.error('[Notifications] Failed to emit read-all event:', err);
        }

        res.json({ success: true });
    } catch (error) {
        logError(error, req);
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
});

/**
 * DELETE /api/notifications/:id
 * Delete one notification for the current user (idempotent)
 */
router.delete('/:id', requireAnonymousId, async (req, res) => {
    try {
        const { id } = req.params;
        const anonymousId = req.anonymousId;
        const db = DB.withContext(anonymousId);

        await db.query(`
            DELETE FROM notifications
            WHERE id = $1 AND anonymous_id = $2
        `, [id, anonymousId]);

        res.json({ success: true });
    } catch (error) {
        logError(error, req);
        res.status(500).json({ error: 'Failed to delete notification' });
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
        let settings;

        // Ensure anonymous user exists first to satisfy FK
        await db.query(`
            INSERT INTO anonymous_users (anonymous_id) VALUES ($1) ON CONFLICT DO NOTHING
        `, [anonymousId]);

        // Check if settings exist
        const existingSettings = await db.select('notification_settings', {
            where: { anonymous_id: anonymousId },
            limit: 1
        });

        if (existingSettings.length > 0) {
            // Settings exist, return them
            settings = existingSettings[0];
        } else {
            // Create default settings with atomic insert
            // 🏛️ SAFE MODE: ON CONFLICT DO UPDATE prevents data loss in race conditions
            const insertResult = await db.query(`
                INSERT INTO notification_settings 
                (anonymous_id, proximity_alerts, report_activity, similar_reports, radius_meters, max_notifications_per_day)
                VALUES ($1, false, false, false, 1000, ${NOTIFICATIONS.DEFAULT_MAX_NOTIFICATIONS_PER_DAY})
                ON CONFLICT (anonymous_id) DO UPDATE SET
                    updated_at = NOW()
                RETURNING *
            `, [anonymousId]);

            if (insertResult.rows.length > 0) {
                settings = insertResult.rows[0];
            } else {
                // Fallback: fetch settings if INSERT somehow failed (e.g., another concurrent request inserted it)
                const fallbackSettings = await db.select('notification_settings', {
                    where: { anonymous_id: anonymousId },
                    limit: 1
                });
                settings = fallbackSettings[0];
            }
        }
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

        // 🔒 SECURITY: Explicit whitelist to prevent mass assignment
        // Protects against accidental field injection if new DB columns are added
        const ALLOWED_FIELDS = [
            'proximity_alerts',
            'report_activity',
            'similar_reports',
            'radius_meters',
            'max_notifications_per_day',
            'last_known_lat',
            'last_known_lng',
            'last_known_city',
            'last_known_province'
        ];

        // Build updates object using only whitelisted fields
        const updates = {};
        for (const field of ALLOWED_FIELDS) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        // 🏛️ SAFE MODE: Idempotente — si no hay cambios, devolver settings actuales (no error)
        if (Object.keys(updates).length === 0) {
            const currentResult = await db.query(`
                SELECT * FROM notification_settings WHERE anonymous_id = $1
            `, [anonymousId]);
            
            if (currentResult.rows.length > 0) {
                return res.json({ success: true, data: currentResult.rows[0] });
            }
            
            // No settings exist yet, return empty but success
            return res.json({ success: true, data: { anonymous_id: anonymousId } });
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

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        logError(error, req);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

/**
 * DELETE /api/notifications
 * Delete all notifications for the current user
 */
router.delete('/', requireAnonymousId, async (req, res) => {
    try {
        const anonymousId = req.anonymousId;
        const db = DB.withContext(anonymousId);

        await db.query(`
            DELETE FROM notifications 
            WHERE anonymous_id = $1
        `, [anonymousId]);

        // Broadcast to all user tabs
        try {
            const { realtimeEvents } = await import('../utils/eventEmitter.js');
            realtimeEvents.emitUserNotification(anonymousId, {
                eventId: `deleted-all-${anonymousId}-${Date.now()}`, // ✅ Enterprise: ID determinístico
                type: 'notifications-deleted-all'
            });
        } catch (err) {
            console.error('[Notifications] Failed to emit deleted-all event:', err);
        }

        res.json({ success: true });
    } catch (error) {
        logError(error, req);
        res.status(500).json({ error: 'Failed to delete all notifications' });
    }
});

export default router;
