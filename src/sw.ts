/// <reference lib="webworker" />
// @ts-ignore - Silence Workbox logs
self.__WB_DISABLE_DEV_LOGS = true;

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

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
// ENTERPRISE SERVICE WORKER - v2.1
// Google/Meta-Level Resilience
// ============================================

// CACHE BUSTING: Automatically injected by Vite at build time
declare const __SW_VERSION__: string;
const SW_VERSION = __SW_VERSION__;

console.log(`[SW] Initializing Version: ${SW_VERSION}`);

// 1. HARD RESET: Delete OLD caches immediately
// only keep the current internal workbox caches and our specific runtime caches


// ============================================
// SW LIFECYCLE
// ============================================

self.addEventListener('install', (_event) => {
    console.log(`[SW] v${SW_VERSION} Installing...`);
    // ❌ NO skipWaiting() here - client controls activation
    // This prevents race conditions between install and activate
});

self.addEventListener('activate', (event) => {
    console.log(`[SW] v${SW_VERSION} Activated`);

    event.waitUntil(
        (async () => {
            // A. Take control immediately
            await self.clients.claim();

            // B. AGGRESSIVE CLEANUP: Remove ANY cache not matching current version scope
            // Note: Workbox precache uses specific naming, we rely on cleanupOutdatedCaches() for that.
            // But we manually clean our custom runtime caches if logic changes.
            // Ideally, we just nuke everything that looks "old".

            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(async (name) => {
                    // C. AGGRESSIVE CLEANUP ("Zero Versions Old" Policy)
                    // We define a whitelist of caches that should exist.
                    // Anything else is considered "old" or "foreign" and is nuked.
                    const VALID_CACHES = [
                        'safespot-images',
                        'safespot-static-assets',
                        // Workbox creates specific names based on config.
                        // We must be careful not to delete the current precache.
                        // Precache names usually contain the manifest revision.
                        // BUT, cleanupOutdatedCaches() already handles workbox-precache.
                        // So we only target our own runtime caches here.
                    ];

                    // If it's a safespot runtime cache AND not in the whitelist -> DELETE
                    // If it's a workbox cache, let cleanupOutdatedCaches() handle it.
                    if (name.startsWith('safespot-') && !VALID_CACHES.includes(name)) {
                        console.log('[SW] Aggressive Cleanup: Deleting old cache', name);
                        await caches.delete(name);
                    }
                })
            );

            // Standard Workbox cleanup for precache
            cleanupOutdatedCaches();

            // Notify clients
            const clients = await self.clients.matchAll({ includeUncontrolled: true });
            clients.forEach(client => {
                client.postMessage({ type: 'SW_ACTIVATED', version: SW_VERSION });
            });
        })()
    );
});

// ============================================
// PRECACHE & ROUTING
// ============================================

precacheAndRoute(self.__WB_MANIFEST);

// ============================================
// RUNTIME CACHING STRATEGIES
// ============================================

// 1. IMAGES: StaleWhileRevalidate (Low Risk)
registerRoute(
    ({ request }) => request.destination === 'image',
    new StaleWhileRevalidate({
        cacheName: 'safespot-images',
        plugins: [
            new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }), // 30 Days
        ],
    })
);

// 2. STATIC ASSETS (Fonts, etc): CacheFirst (Long Term)
registerRoute(
    ({ request }) => request.destination === 'font',
    new CacheFirst({
        cacheName: 'safespot-static-assets',
        plugins: [
            new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 }),
            new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
    })
);

// 3. API CALLS: NetworkOnly (Absolute Truth)
// We NEVER cache API calls in SW. React Query handles memory cache.
registerRoute(
    ({ url }) => url.pathname.startsWith('/api/'),
    new NetworkOnly()
);

// 4. NAVIGATION: NetworkFirst -> Fallback Index
// CRITICAL FIX: NEVER cache HTML - always fetch from network
// This prevents users from being trapped with stale HTML referencing deleted chunks
const navigationHandler = async (params: { request: Request }) => {
    try {
        // ✅ ENTERPRISE FIX: Force bypass browser cache
        const response = await fetch(params.request, {
            cache: 'no-store', // Bypass browser HTTP cache
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });

        if (response && response.ok) {
            return response;
        }
    } catch (error) {
        // Network failed (Offline)
        console.warn('[SW] Navigation request failed, serving offline page:', error);
    }

    // Fallback ONLY if truly offline
    // We prefer to show offline page rather than stale HTML
    return new Response(
        '<!DOCTYPE html><html><body style="background:#020617;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;"><h1>Sin Conexión</h1><p>Verifica tu internet y recarga la página.</p></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
    );
};

registerRoute(
    new NavigationRoute(navigationHandler, {
        denylist: [/^\/api\//, /\.[a-z]+$/i], // Don't handle API or file extensions
    })
);


// ============================================
// PUSH EVENT PASS-THROUGH
// ============================================
// (Logic unchanged, just ensuring it's robust)
self.addEventListener('push', (event) => {
    let data;
    try {
        data = event.data?.json();
    } catch (e) {
        return;
    }

    const title = data?.title || 'SafeSpot';
    const options = {
        body: data?.body || 'Nueva notificación',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: data
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: any) => {
    event.notification.close();

    // ... Existing click handling logic (kept simple for brevity in plan, but needs to be here) ...
    // Re-implementing the robust navigation logic from before
    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        (async () => {
            const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

            // Try to focus existing
            for (const client of allClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    await client.focus();
                    client.postMessage({ type: 'NAVIGATE_TO', url: urlToOpen });
                    return;
                }
            }

            // Open new
            if (self.clients.openWindow) {
                await self.clients.openWindow(urlToOpen);
            }
        })()
    );
});
