/// <reference lib="webworker" />

/**
 * SafeSpot Service Worker
 * 
 * Handles push notifications and caching.
 */

const SW_VERSION = '1.0.0';

// ============================================
// PUSH NOTIFICATIONS
// ============================================

self.addEventListener('push', (event) => {
    console.log('[SW] Push received:', event);

    let data = {
        title: '⚠️ Nuevo reporte cerca tuyo',
        body: 'Hay actividad en tu zona',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: { url: '/mapa' }
    };

    // Parse push payload
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            console.error('[SW] Error parsing push data:', e);
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/icons/icon-192x192.png',
        badge: data.badge || '/icons/badge-72x72.png',
        tag: data.tag || 'safespot-notification',
        vibrate: [100, 50, 100],
        data: data.data || { url: '/mapa' },
        actions: [
            { action: 'view', title: 'Ver en mapa' },
            { action: 'close', title: 'Cerrar' }
        ],
        requireInteraction: false
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// ============================================
// NOTIFICATION CLICK
// ============================================

self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification click:', event.action);

    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    // Get URL from notification data
    const url = event.notification.data?.url || '/mapa';
    const fullUrl = new URL(url, self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Check if app is already open
                for (const client of windowClients) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        // Navigate existing window
                        client.navigate(fullUrl);
                        return client.focus();
                    }
                }
                // Open new window
                return clients.openWindow(fullUrl);
            })
    );
});

// ============================================
// SERVICE WORKER LIFECYCLE
// ============================================

self.addEventListener('install', (event) => {
    console.log('[SW] Install v' + SW_VERSION);
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activate v' + SW_VERSION);
    event.waitUntil(self.clients.claim());
});
