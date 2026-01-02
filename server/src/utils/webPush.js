/**
 * Web Push Service
 * 
 * Handles sending push notifications using the Web Push API.
 * Uses VAPID for authentication.
 */

import webpush from 'web-push';
import { logError, logSuccess } from './logger.js';

// ============================================
// VAPID CONFIGURATION
// ============================================

// VAPID keys should be generated once and stored in environment
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:soporte@safespot.app';

// Configure web-push
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    logSuccess('Web Push configured with VAPID keys');
} else {
    console.warn('⚠️ VAPID keys not configured - push notifications disabled');
}

// ============================================
// TYPES
// ============================================

/**
 * @typedef {Object} PushSubscription
 * @property {string} endpoint
 * @property {string} p256dh
 * @property {string} auth
 */

/**
 * @typedef {Object} NotificationPayload
 * @property {string} title
 * @property {string} body
 * @property {string} [icon]
 * @property {string} [badge]
 * @property {string} [tag]
 * @property {Object} [data]
 * @property {Array} [actions]
 */

// ============================================
// PUSH FUNCTIONS
// ============================================

/**
 * Send a push notification to a single subscription
 * 
 * @param {PushSubscription} subscription - Web Push subscription
 * @param {NotificationPayload} payload - Notification content
 * @returns {Promise<{success: boolean, statusCode?: number, error?: string}>}
 */
export async function sendPushNotification(subscription, payload) {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        return { success: false, error: 'VAPID not configured' };
    }

    const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
        }
    };

    try {
        const result = await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(payload),
            {
                TTL: 3600, // 1 hour time-to-live
                urgency: 'normal'
            }
        );

        logSuccess('Push notification sent', {
            endpoint: subscription.endpoint.substring(0, 50) + '...',
            statusCode: result.statusCode
        });

        return { success: true, statusCode: result.statusCode };
    } catch (error) {
        // Handle specific error codes
        if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription expired or invalid - should be removed
            return {
                success: false,
                statusCode: error.statusCode,
                error: 'SUBSCRIPTION_EXPIRED'
            };
        }

        logError(error, { context: 'webPush.sendNotification' });
        return {
            success: false,
            statusCode: error.statusCode,
            error: error.message
        };
    }
}

/**
 * Send notifications to multiple subscriptions
 * Returns results for cleanup of expired subscriptions
 * 
 * @param {Array<{subscription: PushSubscription, subscriptionId: string}>} subscriptions
 * @param {NotificationPayload} payload
 * @returns {Promise<{sent: number, failed: number, expired: string[]}>}
 */
export async function sendBatchNotifications(subscriptions, payload) {
    const results = {
        sent: 0,
        failed: 0,
        expired: [] // IDs to remove from DB
    };

    // Send in parallel with concurrency limit
    const BATCH_SIZE = 10;
    for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
        const batch = subscriptions.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(
            batch.map(async ({ subscription, subscriptionId }) => {
                const result = await sendPushNotification(subscription, payload);
                return { subscriptionId, result };
            })
        );

        for (const outcome of batchResults) {
            if (outcome.status === 'fulfilled') {
                const { subscriptionId, result } = outcome.value;
                if (result.success) {
                    results.sent++;
                } else {
                    results.failed++;
                    if (result.error === 'SUBSCRIPTION_EXPIRED') {
                        results.expired.push(subscriptionId);
                    }
                }
            } else {
                results.failed++;
            }
        }
    }

    return results;
}

/**
 * Create notification payload for a nearby report
 * 
 * @param {Object} report - Report data
 * @param {number} distanceMeters - Distance to user
 * @returns {NotificationPayload}
 */
export function createReportNotificationPayload(report, distanceMeters) {
    const distanceText = distanceMeters < 1000
        ? `a ${Math.round(distanceMeters)}m`
        : `a ${(distanceMeters / 1000).toFixed(1)}km`;

    // Map categories to icons (assuming these exist, otherwise fallback to main icon)
    // Custom icons should be placed in public/icons/
    let icon = '/icons/icon-192x192.png';
    const category = (report.category || '').toLowerCase();

    // Simple category mapping (could be expanded)
    if (category.includes('polic') || category.includes('robo') || category.includes('seguridad')) {
        icon = '/icons/icon-192x192.png'; // Use specific if available, e.g. /icons/security.png
    } else if (category.includes('fuego') || category.includes('incendio')) {
        icon = '/icons/icon-192x192.png';
    }

    return {
        title: '⚠️ Nuevo reporte cerca tuyo',
        body: `${report.category || 'Incidente'} · ${distanceText}\n${report.title || ''}`,
        icon: icon,
        badge: '/icons/badge-72x72.png',
        tag: `report-${report.id}`, // Groups updates for this specific report
        renotify: true,
        data: {
            reportId: report.id,
            url: `/mapa?focus=${report.id}`,
            timestamp: Date.now()
        },
        actions: [
            {
                action: 'map',
                title: '📍 Ver en Mapa'
            },
            {
                action: 'dismiss',
                title: '✅ Entendido'
            }
        ]
    };
}

/**
 * Create notification payload for social activity (likes/comments)
 * 
 * @param {Object} data - Activity data
 * @param {string} data.type - 'like' | 'comment' | 'reply'
 * @param {string} data.title - Notification title
 * @param {string} data.message - Notification body
 * @param {string} data.reportId - Related report ID
 * @param {string} data.entityId - ID of specific entity (comment/like)
 * @returns {NotificationPayload}
 */
export function createActivityNotificationPayload({ type, title, message, reportId, entityId }) {
    let url = `/reporte/${reportId}`;
    let icon = '/icons/icon-192x192.png';

    // Different actions based on type
    const actions = [
        {
            action: 'view_report',
            title: '📄 Abrir Reporte'
        },
        {
            action: 'dismiss',
            title: '✅ Entendido'
        }
    ];

    return {
        title: title,
        body: message,
        icon: icon,
        badge: '/icons/badge-72x72.png',
        tag: `${type}-${entityId}`,
        renotify: true,
        data: {
            url: url,
            reportId: reportId,
            timestamp: Date.now()
        },
        actions: actions
    };
}

/**
 * Get VAPID public key for frontend subscription
 */
export function getVapidPublicKey() {
    return VAPID_PUBLIC_KEY || null;
}

/**
 * Check if push notifications are configured
 */
export function isPushConfigured() {
    return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}
