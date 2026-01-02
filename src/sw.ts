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

self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification click:', event.action);
    event.notification.close();

    const url = event.notification.data?.url || '/mapa';
    const fullUrl = new URL(url, self.location.origin).href;

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                for (const client of windowClients) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus().then(async (c) => {
                            if ('navigate' in c) return c.navigate(fullUrl);
                        });
                    }
                }
                return self.clients.openWindow(fullUrl);
            })
    );
});
