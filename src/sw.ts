/// <reference lib="webworker" />
// @ts-ignore - Silence Workbox logs in development
self.__WB_DISABLE_DEV_LOGS = true;

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

declare let self: ServiceWorkerGlobalScope;

// 1. Tomar el control de los clientes inmediatamente
self.skipWaiting(); // Auto-activate without user interaction
clientsClaim();

// 2. Limpiar cachés antiguos
cleanupOutdatedCaches();

// 3. Pre-caché de assets de construcción (HTML, JS, CSS)
precacheAndRoute(self.__WB_MANIFEST);

// ---------------------------------------------------------
// ESTRATEGIAS DE CACHÉ AVANZADAS
// ---------------------------------------------------------

// A. Imágenes de Reportes (Stale-while-revalidate)
// Las imágenes se muestran instantáneamente desde caché y se actualizan en segundo plano.
registerRoute(
    ({ request }) => request.destination === 'image',
    new StaleWhileRevalidate({
        cacheName: 'safespot-images',
        plugins: [
            new ExpirationPlugin({
                maxEntries: 100, // Máximo 100 imágenes en caché
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días de vida
            }),
            new CacheableResponsePlugin({
                statuses: [0, 200],
            }),
        ],
    })
);

// B. Fuentes de Google y Assets Estáticos (Cache-first)
// Las fuentes cambian muy poco, mejor servirlas al instante desde caché.
registerRoute(
    ({ request }) =>
        request.destination === 'font' ||
        request.url.includes('gstatic.com') ||
        request.url.includes('googleapis.com'),
    new CacheFirst({
        cacheName: 'safespot-static-assets',
        plugins: [
            new ExpirationPlugin({
                maxEntries: 20,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 año
            }),
            new CacheableResponsePlugin({
                statuses: [0, 200],
            }),
        ],
    })
);

// C. Llamadas a la API (Network-first con Timeout y Reload)
// Intentar cargar datos frescos siempre.
// Si la red tarda más de 10s, o falla, usar caché.
// FetchOptions 'reload' fuerza a ignorar la caché HTTP del navegador para ir directo al servidor.
// C. Llamadas a la API (STRICT NETWORK-ONLY - Phase 1 Stabilization)
// El Service Worker ya no maneja timeouts ni errores de API para evitar conflictos de estado.
// React Query es ahora la única fuente de verdad y el encargado de los reintentos.

// GET Requests: Network Only simple
registerRoute(
    ({ url }) => url.pathname.startsWith('/api/'),
    new NetworkOnly(),
    'GET'
);

const bgSyncPlugin = new BackgroundSyncPlugin('safespot-mutations-queue', {
    maxRetentionTime: 24 * 60, // 24 hours
});

type HTTPMethod = 'POST' | 'PUT' | 'DELETE' | 'PATCH';

(['POST', 'PUT', 'DELETE', 'PATCH'] as HTTPMethod[]).forEach(method => {
    registerRoute(
        ({ url }) => url.pathname.startsWith('/api/'),
        new NetworkOnly({
            plugins: [bgSyncPlugin],
        }),
        method
    );
});

// ---------------------------------------------------------

// 3.5. Escuchar mensaje SKIP_WAITING
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// 4. SPA Navigation Routing
// Serve index.html for all navigation requests, EXCEPT API and static assets
// This fixes "Router is responding to /api/..." issues
const navigationRoute = new NavigationRoute(
    async ({ request }) => {
        // PHASE 2: NETWORK-FIRST for HTML
        const CACHE_NAME = 'safespot-html-v1';
        const NETWORK_TIMEOUT = 2000;

        const networkPromise = fetch(request, { cache: 'no-cache' });
        const timeoutPromise = new Promise<Response>((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT);
        });

        try {
            const response = await Promise.race([networkPromise, timeoutPromise]);
            if (response.ok) {
                const cache = await caches.open(CACHE_NAME);
                cache.put(request, response.clone());
                return response;
            }
            throw new Error(`Response not ok: ${response.status}`);
        } catch (error) {
            console.warn('[SW] Network failed, using cache');
            const cache = await caches.open(CACHE_NAME);
            const cached = await cache.match(request);
            if (cached) return cached;

            return new Response('Offline', { status: 503 });
        }
    }, {
    denylist: [
        /^\/api\//,       // Exclude API
        /\.[a-z]+$/i,     // Exclude files with extensions (images, js, css)
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
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Enterprise Rule: Intelligent Suppression
                // If the app is open and visible, DO NOT show native push.
                // The UI (SSE) will handle it, or we send a message to trigger a Toast.
                const hasVisibleClient = clientList.some(client =>
                    client.visibilityState === 'visible' &&
                    client.url.startsWith(self.location.origin) // Same origin safety
                );

                if (hasVisibleClient) {
                    console.log('[SW] App is visible - Suppressing native notification');

                    // Optional: Send signal to client in case SSE missed (redundancy)
                    clientList.forEach(client => {
                        client.postMessage({
                            type: 'IN_APP_NOTIFICATION',
                            payload: data
                        });
                    });

                    return; // EXIT: No native notification
                }

                // App not visible -> Show Native Push
                return self.registration.showNotification(data.title, options);
            })
    );
});

self.addEventListener('notificationclick', (event: any) => {
    console.log('[SW] Notification click - action:', event.action, 'data:', event.notification.data);
    event.notification.close();

    // 1. Handle "Dismiss" action (Entendido) - ONLY if explicitly clicked
    if (event.action === 'dismiss' || event.action === 'mark-read') {
        console.log('[SW] Dismiss/Read action');

        if (event.action === 'mark-read' && event.notification.data?.roomId) {
            // FIRE AND FORGET: Mark as read via API
            const roomId = event.notification.data.roomId;
            const anonymousId = event.notification.data.anonymousId; // Should be in payload

            if (anonymousId) {
                fetch(`/api/chats/${roomId}/read`, {
                    method: 'PATCH',
                    headers: { 'x-anonymous-id': anonymousId }
                }).catch(e => console.error('[SW] Mark read failed:', e));
            }
        }

        return;
    }

    // 2. Determine URL based on action or default
    let url = event.notification.data?.url || '/explorar';

    // Handle specific actions
    if (event.action === 'map') {
        // Explicit map button click
        if (event.notification.data?.reportId) {
            url = `/explorar?reportId=${event.notification.data.reportId}`;
        } else {
            url = '/explorar';
        }
        console.log('[SW] Navigating to map:', url);
    } else if (event.action === 'view_report') {
        if (event.notification.data?.reportId) {
            url = `/reporte/${event.notification.data.reportId}`;
        }
        console.log('[SW] Navigating to report:', url);
    } else if (event.action === 'view_profile') {
        if (event.notification.data?.url) {
            url = event.notification.data.url;
        }
        console.log('[SW] Navigating to profile:', url);
    } else if (event.action === 'open-chat' || (event.action === '' && event.notification.data?.roomId)) {
        // Chat notification click
        if (event.notification.data?.roomId) {
            url = `/mensajes/${event.notification.data.roomId}`;
        }
        console.log('[SW] Navigating to chat room:', url);
    } else if (event.action === '') {
        // Body click - use data.url if present (default logic), or fallback based on data
        if (!event.notification.data?.url && event.notification.data?.reportId) {
            // Fallback for old payloads if any
            url = `/explorar?reportId=${event.notification.data.reportId}`;
        }
        console.log('[SW] Notification body click, url:', url);
    }

    const fullUrl = new URL(url, self.location.origin).href;
    console.log('[SW] Full URL:', fullUrl);

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                console.log('[SW] Found', windowClients.length, 'window clients');

                // 1. Try to find a client that is ALREADY at the correct URL (Exact Match)
                for (const client of windowClients) {
                    if (client.url === fullUrl && 'focus' in client) {
                        console.log('[SW] Focusing existing window with exact URL');
                        return client.focus().then(() => undefined); // Return void
                    }
                }

                // 2. Try to find any client of our origin to Takeover
                for (const client of windowClients) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        console.log('[SW] Focusing client for Soft Navigation');
                        return client.focus().then(() => {
                            // ENTERPRISE FIX: RACE CONDITION
                            // DO NOT call client.navigate(url). It fails on Android/Samsung often.
                            // INSTEAD, send a message to the React App to handle routing.
                            client.postMessage({
                                type: 'NAVIGATE_TO',
                                url: fullUrl
                            });
                            return undefined; // Return void
                        });
                    }
                }

                // 3. Fallback: Open new window if no client is active
                console.log('[SW] No active client found, opening new window');
                if (self.clients.openWindow) {
                    return self.clients.openWindow(fullUrl).then(() => undefined);
                }
            })
    );
});
