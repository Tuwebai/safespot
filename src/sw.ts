/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;

// 1. Claim clients immediately to control the page ASAP
self.skipWaiting();
clientsClaim();

// 2. Cleanup old caches
cleanupOutdatedCaches();

// 3. Precache build assets (HTML, JS, CSS)
// This variable is injected by VitePWA at build time
precacheAndRoute(self.__WB_MANIFEST);

// 4. SPA Navigation Routing
// Serve index.html for all navigation requests, EXCEPT API and static assets
// This fixes "Router is responding to /api/..." issues
const navigationRoute = new NavigationRoute(
    async (params) => {
        try {
            // Simple Network Validation for navigation
            // Try to fetch functionality or fallback to index.html if offline
            // For standard SPA PWA:
            return fetch(params.request).catch(() => {
                return caches.match('/index.html').then(response => {
                    return response || new Response('Offline', { status: 503 });
                });
            });
        } catch (error) {
            return fetch(params.request);
        }
    }, {
    denylist: [
        /^\/api\//,       // Exclude API
        /\.[a-z]+$/i,     // Exclude files with extensions
    ],
}
);

// REGISTER THE ROUTE to avoid "unused variable" error
registerRoute(navigationRoute);

// ============================================
// PUSH NOTIFICATIONS
// ============================================

self.addEventListener('push', (event) => {
    console.log('[SW] Push received:', event);

    let data = {
        title: '⚠️ Nuevo reporte cerca tuyo',
        body: 'Hay actividad en tu zona',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'safespot-notification',
        data: { url: '/mapa' },
        actions: []
    };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            console.error('[SW] Error parsing push data:', e);
        }
    }

    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        tag: data.tag,
        vibrate: [100, 50, 100],
        data: data.data,
        actions: data.actions || [],
        requireInteraction: false
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event: any) => {
    console.log('[SW] Notification click:', event.action);
    event.notification.close();

    // 1. Handle "Dismiss" action (Entendido)
    if (event.action === 'dismiss' || event.action === 'mark-read') {
        // Just close (already closed above) and return
        return;
    }

    // 2. Determine functionality based on action or default URL
    let url = event.notification.data?.url || '/explorar';

    // Explicit actions (override URL logic if needed)
    if (event.action === 'map') {
        // Ensure it goes to map (data.url usually has this, but be safe)
        if (event.notification.data?.reportId) {
            url = `/explorar?reportId=${event.notification.data.reportId}`;
        } else {
            url = '/explorar';
        }
    } else if (event.action === 'view_report') {
        if (event.notification.data?.reportId) {
            url = `/reporte/${event.notification.data.reportId}`;
        }
    }

    const fullUrl = new URL(url, self.location.origin).href;

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Check if there is already a window/tab open with the target URL
                for (const client of windowClients) {
                    if (client.url === fullUrl && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Check if there is any window open for this origin to focus and navigate
                for (const client of windowClients) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus().then(async (c: any) => {
                            if ('navigate' in c) return c.navigate(fullUrl);
                        });
                    }
                }
                // Otherwise open new window
                if (self.clients.openWindow) {
                    return self.clients.openWindow(fullUrl);
                }
            })
    );
});
