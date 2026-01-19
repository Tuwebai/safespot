/// <reference lib="webworker" />
// @ts-ignore - Silence Workbox logs
self.__WB_DISABLE_DEV_LOGS = true;

import { cleanupOutdatedCaches, precacheAndRoute, matchPrecache } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// ... (other imports)

// ============================================
// PUSH EVENT HANDLING (Pure Passthrough)
// ============================================

self.addEventListener('push', (event) => {
    // 1. Parse Payload
    let data;
    try {
        data = event.data?.json();
    } catch (e) {
        console.warn('Push parse error', e);
        return;
    }

    // 2. Normalize Defaults (Fail-safe)
    const title = data?.title || 'SafeSpot Notification';
    const options = {
        body: data?.body || 'Nuevo evento',
        icon: data?.icon || '/icons/icon-192.png',
        badge: data?.badge || '/icons/icon-192.png',
        tag: data?.tag || 'safespot-generic',
        data: data, // Keep raw data for click handler
        requireInteraction: false
    };

    // 3. Show Notification (Always show, no hidden logic)
    const notificationPromise = self.registration.showNotification(title, options);
    event.waitUntil(notificationPromise);
});

// Auth DB and Delivery Queue REMOVED.
// SW is now dumb infrastructure.
// - Delivery Reliability -> handled by Backend/React Query Sync
// - Auth Token -> Not needed in SW anymore (no API calls)

declare let self: ServiceWorkerGlobalScope;

// ============================================
// ENTERPRISE SERVICE WORKER - v2.0
// Google/Meta-Level Resilience
// ============================================

// CACHE BUSTING: Automatically injected by Vite at build time
// Format: "2.4.0-pro_{timestamp}"
const SW_VERSION = __SW_VERSION__;
console.log(`[SW] Initializing Version: ${SW_VERSION}`);


// ===========================================
// CACHE MANAGER (Staleness + Integrity)
// ===========================================



// ============================================
// SW INSTALLATION & ACTIVATION
// ============================================

// IMMEDIATE activation
self.skipWaiting();
clientsClaim();

// Cleanup old caches
cleanupOutdatedCaches();

// Precache build assets
precacheAndRoute(self.__WB_MANIFEST);

// ============================================
// SW UPDATE HANDLING (Race Mitigation)
// ============================================

self.addEventListener('install', (event) => {
    console.log('[SW] v' + SW_VERSION + ' installing...');

    event.waitUntil(
        (async () => {
            const clients = await self.clients.matchAll({ includeUncontrolled: true });

            if (clients.length > 0) {
                // Notify clients that update is pending
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'SW_UPDATE_PENDING',
                        version: SW_VERSION,
                    });
                });

                // Wait 2s for active requests to complete
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }

            await self.skipWaiting();
        })()
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW] v' + SW_VERSION + ' activated');

    event.waitUntil(
        (async () => {
            // CRITICAL FIX: Delete ALL old caches
            // This prevents stale data from persisting across SW updates
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(cacheName => {
                    // Keep only current version caches
                    // ✅ SAFETY: Only delete caches that we explicitly manage (safespot-)
                    // and that do NOT match the current version.
                    if (cacheName.startsWith('safespot-') && !cacheName.includes(SW_VERSION)) {
                        console.log(`[SW] Deleting stale cache: ${cacheName} (Current: ${SW_VERSION})`);
                        return caches.delete(cacheName);
                    }
                })
            );

            await self.clients.claim();

            // Notify all clients that SW updated
            const clients = await self.clients.matchAll({ includeUncontrolled: true });
            clients.forEach((client) => {
                client.postMessage({
                    type: 'SW_UPDATED',
                    version: SW_VERSION,
                });
            });

            // ✅ Soft Update: No forced reload.
            // Client will show Toast to user.
        })()
    );
});

// Listen for SKIP_WAITING message
// (Consolidated into unified listener above)

// ============================================
// CACHE STRATEGIES
// ============================================

// A. Images: StaleWhileRevalidate
registerRoute(
    ({ request }) => request.destination === 'image',
    new StaleWhileRevalidate({
        cacheName: 'safespot-images',
        plugins: [
            new ExpirationPlugin({
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
            }),
            new CacheableResponsePlugin({
                statuses: [0, 200],
            }),
        ],
    })
);

// B. Fonts: CacheFirst
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
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
            }),
            new CacheableResponsePlugin({
                statuses: [0, 200],
            }),
        ],
    })
);

// C. API Calls: ENTERPRISE NetworkFirst with Semantic Fallback
// C. API Calls: ENTERPRISE SAFETY FIX (Phase 1)
// ❌ INVARIANT: SW must NEVER cache dynamic API responses.
// React Query is the Single Source of Truth for server state.
// We use NetworkOnly to ensure we always get fresh data or fail.
// C. API Calls: ENTERPRISE SAFETY FIX (Phase 2)
// ❌ INVARIANT: SW must NEVER hang indefinitely.
// We implement a "NetworkOnly with Timeout" strategy.
// If the network is slow/hanging (>10s), we fail fast so the Client (React Query)
// can handle the error (show retry button, offline mode, etc).
registerRoute(
    ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
    async ({ request }) => {
        // 1. Create a timeout promise (10s)
        const timeoutPromise = new Promise<Response>((_, reject) =>
            setTimeout(() => reject(new Error('SW_API_TIMEOUT')), 10000)
        );

        // 2. Race Network vs Timeout
        try {
            const response = await Promise.race([
                fetch(request),
                timeoutPromise
            ]);
            return response;
        } catch (error) {
            // Failure = Return 504 (Gateway Timeout) or 503 (Service Unavailable)
            // This ensures React Query receives an error and stops "Loading..."
            console.warn('[SW] API Request Failed or Timed Out:', request.url);
            return new Response(JSON.stringify({ error: 'Network Timeout' }), {
                status: 504,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
);

// D. Mutations: NetworkOnly with BackgroundSync
// D. Mutations: NetworkOnly (Simple)
// React Query handles retry/offline-queue on the client side.
type HTTPMethod = 'POST' | 'PUT' | 'DELETE' | 'PATCH';

(['POST', 'PUT', 'DELETE', 'PATCH'] as HTTPMethod[]).forEach((method) => {
    registerRoute(
        ({ url }) => url.pathname.startsWith('/api/'),
        new NetworkOnly(),
        method
    );
});

// E. HTML Navigation: NetworkFirst WITHOUT caching (CRITICAL FIX)
// E. HTML Navigation: App Shell Fallback (Offline First + Network Freshness)
// [SW-02] Offline Dead-End FIX
const navigationRoute = new NavigationRoute(
    async ({ request }) => {
        // Timeout tunning (5s)
        const TIMEOUT = 5000;

        // 1. Try Network (Freshness)
        // We want the latest HTML if possible
        const networkPromise = fetch(request, {
            cache: 'no-store', // Always fetch fresh
            headers: { 'Cache-Control': 'no-cache' }
        });

        const timeoutPromise = new Promise<Response>((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), TIMEOUT);
        });

        try {
            const response = await Promise.race([networkPromise, timeoutPromise]);
            if (response.ok) {
                return response; // Fresh HTML
            }
            throw new Error(`Response not ok: ${response.status}`);
        } catch (error) {
            // 2. Offline Fallback: Serve App Shell
            // [SW-02] Fix: Never return static error HTML.
            // Return cached /index.html so the app can mount and show local data.
            console.warn(`[SW-v${SW_VERSION}] [NAV] Navigation failed, serving App Shell`, error);

            // Use matchPrecache to safely retrieve the versioned index.html
            const cachedResponse = await matchPrecache('/index.html');

            if (cachedResponse) {
                return cachedResponse;
            }

            // Fallback purely defensive if Precache failed completely (Should not happen)
            return new Response(
                '<!DOCTYPE html><html><body><h1>Offline Mode Check</h1><p>App Shell missing.</p></body></html>',
                { status: 503, headers: { 'Content-Type': 'text/html' } }
            );
        }
    },
    {
        denylist: [/^\/api\//, /\.[a-z]+$/i],
    }
);

registerRoute(navigationRoute);

// ============================================
// PUSH NOTIFICATIONS (unchanged)
// ============================================

// (Old Push Listener Removed)

self.addEventListener('notificationclick', (event: any) => {
    console.log('[SW] Notification click');
    event.notification.close();

    if (event.action === 'dismiss' || event.action === 'mark-read') {
        if (event.action === 'mark-read') {
            const roomId = event.notification.data?.roomId;
            const anonymousId = event.notification.data?.anonymousId;

            // ✅ P1 FIX: Validación defensiva
            if (!roomId || !anonymousId) {
                console.warn('[SW] mark-read aborted: missing roomId or anonymousId in payload', {
                    roomId,
                    anonymousId,
                    data: event.notification.data
                });
                return; // Fail-safe: no romper la notificación
            }

            fetch(`/api/chats/${roomId}/read`, {
                method: 'PATCH',
                headers: { 'x-anonymous-id': anonymousId },
            }).catch((e) => console.error('[SW] Mark read failed:', e));
        }
        return;
    }

    let url = event.notification.data?.url || '/explorar';

    if (event.action === 'map') {
        url = event.notification.data?.reportId
            ? `/explorar?reportId=${event.notification.data.reportId}`
            : '/explorar';
    } else if (event.action === 'view_report' && event.notification.data?.reportId) {
        url = `/reporte/${event.notification.data.reportId}`;
    } else if (event.action === 'view_profile' && event.notification.data?.url) {
        url = event.notification.data.url;
    } else if ((event.action === 'open-chat' || event.action === '') && event.notification.data?.roomId) {
        url = `/mensajes/${event.notification.data.roomId}`;
    }

    const fullUrl = new URL(url, self.location.origin).href;

    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                for (const client of windowClients) {
                    if (client.url === fullUrl && 'focus' in client) {
                        return client.focus().then(() => undefined);
                    }
                }

                for (const client of windowClients) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus().then(() => {
                            client.postMessage({
                                type: 'NAVIGATE_TO',
                                url: fullUrl,
                            });
                            return undefined;
                        });
                    }
                }

                if (self.clients.openWindow) {
                    return self.clients.openWindow(fullUrl).then(() => undefined);
                }
            })
    );
});
