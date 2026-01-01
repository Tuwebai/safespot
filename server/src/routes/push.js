/**
 * Push Notifications Routes
 * 
 * Handles push subscription management and notification triggers.
 */

import express from 'express';
import { requireAnonymousId } from '../utils/validation.js';
import { queryWithRLS } from '../utils/rls.js';
import { supabaseAdmin } from '../config/supabase.js';
import { ZONES } from '../config/constants.js';
import { logError, logSuccess } from '../utils/logger.js';
import {
    sendBatchNotifications,
    createReportNotificationPayload,
    getVapidPublicKey,
    isPushConfigured
} from '../utils/webPush.js';

const router = express.Router();

// ============================================
// GET /api/push/vapid-key
// Get public VAPID key for frontend subscription
// ============================================
router.get('/vapid-key', (req, res) => {
    const publicKey = getVapidPublicKey();

    if (!publicKey) {
        return res.status(503).json({
            success: false,
            error: 'Push notifications not configured'
        });
    }

    res.json({
        success: true,
        publicKey
    });
});

// ============================================
// POST /api/push/subscribe
// Register a new push subscription
// ============================================
router.post('/subscribe', requireAnonymousId, async (req, res) => {
    try {
        const anonymousId = req.headers['x-anonymous-id'];
        const { subscription, location, radius = 500 } = req.body;

        // Validate subscription data
        if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
            return res.status(400).json({
                success: false,
                error: 'Invalid subscription data'
            });
        }

        // Validate location
        if (!location?.lat || !location?.lng) {
            return res.status(400).json({
                success: false,
                error: 'Location is required for proximity notifications'
            });
        }

        // Validate radius
        const validRadii = ZONES.VALID_RADII;
        const safeRadius = validRadii.includes(radius) ? radius : ZONES.VALID_RADII[0];

        // Upsert subscription (update if endpoint exists)
        const { data, error } = await supabaseAdmin
            .from('push_subscriptions')
            .upsert({
                anonymous_id: anonymousId,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                last_known_lat: location.lat,
                last_known_lng: location.lng,
                radius_meters: safeRadius,
                is_active: true
            }, {
                onConflict: 'endpoint',
                ignoreDuplicates: false
            })
            .select()
            .single();

        if (error) {
            logError(error, req);
            return res.status(500).json({
                success: false,
                error: 'Failed to save subscription'
            });
        }

        logSuccess('Push subscription created', { anonymousId, radius: safeRadius });

        res.json({
            success: true,
            data: {
                id: data.id,
                radius: data.radius_meters,
                isActive: data.is_active
            }
        });
    } catch (error) {
        logError(error, req);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// ============================================
// DELETE /api/push/subscribe
// Unsubscribe from push notifications
// ============================================
router.delete('/subscribe', requireAnonymousId, async (req, res) => {
    try {
        const anonymousId = req.headers['x-anonymous-id'];

        const { error } = await queryWithRLS(anonymousId, `
      UPDATE push_subscriptions
      SET is_active = false
      WHERE anonymous_id = $1
    `, [anonymousId]);

        if (error) {
            logError(error, req);
            return res.status(500).json({
                success: false,
                error: 'Failed to unsubscribe'
            });
        }

        logSuccess('Push subscription deactivated', { anonymousId });

        res.json({
            success: true,
            message: 'Unsubscribed successfully'
        });
    } catch (error) {
        logError(error, req);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// ============================================
// PATCH /api/push/location
// Update user's location for proximity notifications
// ============================================
router.patch('/location', requireAnonymousId, async (req, res) => {
    try {
        const anonymousId = req.headers['x-anonymous-id'];
        const { lat, lng } = req.body;

        if (typeof lat !== 'number' || typeof lng !== 'number') {
            return res.status(400).json({
                success: false,
                error: 'Invalid coordinates'
            });
        }

        const { error } = await queryWithRLS(anonymousId, `
      UPDATE push_subscriptions
      SET last_known_lat = $2, last_known_lng = $3
      WHERE anonymous_id = $1 AND is_active = true
    `, [anonymousId, lat, lng]);

        if (error) {
            logError(error, req);
            return res.status(500).json({
                success: false,
                error: 'Failed to update location'
            });
        }

        res.json({ success: true });
    } catch (error) {
        logError(error, req);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// ============================================
// GET /api/push/status
// Get current subscription status
// ============================================
router.get('/status', requireAnonymousId, async (req, res) => {
    try {
        const anonymousId = req.headers['x-anonymous-id'];

        const result = await queryWithRLS(anonymousId, `
      SELECT id, is_active, radius_meters, last_known_lat, last_known_lng
      FROM push_subscriptions
      WHERE anonymous_id = $1 AND is_active = true
      LIMIT 1
    `, [anonymousId]);

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: { isSubscribed: false }
            });
        }

        const sub = result.rows[0];
        res.json({
            success: true,
            data: {
                isSubscribed: true,
                radius: sub.radius_meters,
                hasLocation: !!(sub.last_known_lat && sub.last_known_lng)
            }
        });
    } catch (error) {
        logError(error, req);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// ============================================
// INTERNAL: Notify nearby users about a new report
// Called from reports.js after successful creation
// ============================================
export async function notifyNearbyUsers(report) {
    if (!isPushConfigured()) {
        return { sent: 0, message: 'Push not configured' };
    }

    if (!report.latitude || !report.longitude || !report.anonymous_id) {
        return { sent: 0, message: 'Report missing location or author' };
    }

    try {
        // Find nearby subscribers using PostGIS function
        const { data: subscribers, error } = await supabaseAdmin.rpc(
            'find_nearby_subscribers',
            {
                report_lat: report.latitude,
                report_lng: report.longitude,
                exclude_anonymous_id: report.anonymous_id,
                max_radius_meters: 2000
            }
        );

        if (error) {
            logError(error, { context: 'notifyNearbyUsers.findSubscribers' });
            return { sent: 0, error: error.message };
        }

        if (!subscribers || subscribers.length === 0) {
            return { sent: 0, message: 'No nearby subscribers' };
        }

        // Prepare subscriptions for batch send
        const subscriptionsToNotify = subscribers.map(sub => ({
            subscriptionId: sub.subscription_id,
            subscription: {
                endpoint: sub.endpoint,
                p256dh: sub.p256dh,
                auth: sub.auth
            },
            distance: sub.distance_meters
        }));

        // Create notification payload (use average distance for grouped notification)
        const avgDistance = subscriptionsToNotify.reduce((sum, s) => sum + s.distance, 0) / subscriptionsToNotify.length;
        const payload = createReportNotificationPayload(report, avgDistance);

        // Send notifications
        const results = await sendBatchNotifications(
            subscriptionsToNotify.map(s => ({
                subscription: s.subscription,
                subscriptionId: s.subscriptionId
            })),
            payload
        );

        // Update last_notified_at for sent notifications
        if (results.sent > 0) {
            const sentIds = subscriptionsToNotify
                .filter((_, i) => i < results.sent)
                .map(s => s.subscriptionId);

            await supabaseAdmin
                .from('push_subscriptions')
                .update({
                    last_notified_at: new Date().toISOString(),
                    notifications_today: supabaseAdmin.rpc('increment_notifications_today')
                })
                .in('id', sentIds);
        }

        // Cleanup expired subscriptions
        if (results.expired.length > 0) {
            await supabaseAdmin
                .from('push_subscriptions')
                .delete()
                .in('id', results.expired);

            logSuccess('Cleaned up expired subscriptions', { count: results.expired.length });
        }

        logSuccess('Nearby users notified', {
            sent: results.sent,
            failed: results.failed,
            reportId: report.id
        });

        return results;
    } catch (error) {
        logError(error, { context: 'notifyNearbyUsers' });
        return { sent: 0, error: error.message };
    }
}

export default router;
