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
self.skipWaiting();
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
// C. Llamadas a la API (STRICT NETWORK-ONLY - Enterprise Grade)
// REGLA DE ORO: La UI jamás debe mostrar datos viejos.
// Si no hay red, la petición falla y la UI debe mostrar estado "Offline/Pending", nunca cache.
const apiHandler = new NetworkOnly({
    plugins: [
        {
            // Custom timeout plugin to enforce 3s limit
            requestWillFetch: async ({ request }) => {
                // Clone request to add AbortSignal logic if needed by browser, 
                // but Workbox handles strategy timeouts better via networkTimeoutSeconds won't work on NetworkOnly.
                // We rely on standard fetch or client timeout.
                // CRITICAL FIX: Do NOT inject headers into the REQUEST. This causes CORS preflight failures.
                // The 'cache: no-store' option is sufficient to prevent browser caching of the response.
                return new Request(request, {
                    cache: 'no-store'
                });
            },
            handlerDidError: async () => {
                // If network fails, return 503 Service Unavailable
                // This forces the UI to handle the error state instead of showing fallback content
                return new Response(JSON.stringify({ error: 'Network Unavailable', code: 'OFFLINE_MODE' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
    ]
});

// Helper to wrap with timeout functionality since NetworkOnly doesn't support networkTimeoutSeconds natively
const timeoutWrapper = async (options: any) => {
    const TIMEOUT_MS = 3000;
    const timeoutPromise = new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), TIMEOUT_MS)
    );

    try {
        return await Promise.race([
            apiHandler.handle(options),
            timeoutPromise
        ]);
    } catch (error) {
        // Return 504 Gateway Timeout if actual timeout
        if (error instanceof Error && error.message === 'Request timed out') {
            return new Response(JSON.stringify({ error: 'Request Timed Out', code: 'TIMEOUT' }), {
                status: 504,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        throw error;
    }
};

registerRoute(
    ({ url }) => url.pathname.startsWith('/api/'),
    timeoutWrapper
);

// D. Background Sync para Mutaciones (POST, PUT, DELETE)
// Si no hay red, guardamos la petición y la reintentamos cuando vuelva la conexión.
// Ideal para reportes, comentarios, likes.
const bgSyncPlugin = new BackgroundSyncPlugin('safespot-mutations-queue', {
    maxRetentionTime: 24 * 60, // Reintentar por hasta 24 horas
});

const mutationHandler = new NetworkOnly({
    plugins: [bgSyncPlugin],
});

// Need to cast to specific HTTPMethod type for TS
type HTTPMethod = 'POST' | 'PUT' | 'DELETE' | 'PATCH';

(['POST', 'PUT', 'DELETE', 'PATCH'] as HTTPMethod[]).forEach(method => {
    registerRoute(
        ({ url }) => url.pathname.startsWith('/api/'),
        mutationHandler,
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
    console.log('[SW] Notification click - action:', event.action, 'data:', event.notification.data);
    event.notification.close();

    // 1. Handle "Dismiss" action (Entendido) - ONLY if explicitly clicked
    if (event.action === 'dismiss' || event.action === 'mark-read') {
        console.log('[SW] Dismiss action - closing notification only');
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

                // Check if there is already a window/tab open with the target URL
                for (const client of windowClients) {
                    if (client.url === fullUrl && 'focus' in client) {
                        console.log('[SW] Focusing existing window with exact URL');
                        return client.focus();
                    }
                }

                // Check if there is any window open for this origin to focus and navigate
                for (const client of windowClients) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        console.log('[SW] Focusing existing window and navigating');
                        return client.focus().then((c: any) => {
                            if ('navigate' in c) {
                                console.log('[SW] Navigating client to:', fullUrl);
                                return c.navigate(fullUrl);
                            }
                        });
                    }
                }

                // Otherwise open new window
                console.log('[SW] Opening new window');
                if (self.clients.openWindow) {
                    return self.clients.openWindow(fullUrl);
                }
            })
    );
});
