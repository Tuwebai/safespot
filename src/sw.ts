/// <reference lib="webworker" />
// @ts-ignore - Silence Workbox logs
self.__WB_DISABLE_DEV_LOGS = true;

import { cleanupOutdatedCaches, precacheAndRoute, matchPrecache } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin, Queue } from 'workbox-background-sync';

// ... (other imports)

// ============================================
// REAL-TIME DELIVERY QUEUE (Background Sync)
// ============================================

// Queue for retryable delivery ACKs
// This ensures that if the device receives a push but has flaky network,
// the "Delivered" ACK will eventually reach the server.
const deliveryQueue = new Queue('safespot-delivery-acks', {
    maxRetentionTime: 24 * 60 // Retry for 24 hours
});



self.addEventListener('push', (event) => {
    // [SW-06] Log estructurado
    console.log(`[SW-v${SW_VERSION}] [PUSH] Event received`, event);

    // [SW-04] HARDCODED DEFAULTS (Reliability)
    // No confiamos 100% en el payload para invariantes de sonido.
    let data: any = {
        title: '⚠️ Nuevo reporte',
        body: 'Actividad en tu zona',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'safespot-notification',
        renotify: true,
        data: { url: '/mapa' },
        actions: [],
    };

    if (event.data) {
        try {
            // Merge defaults with payload to prevent missing fields
            const payload = event.data.json();

            // ✅ DEFENSIVE MERGE: Ensure data is an object
            if (payload && typeof payload === 'object') {
                data = { ...data, ...payload };

                // ✅ FIX: Flatten nested data if backend sends { data: { type: ... } }
                // Backend 'webPush.js' puts 'type' inside 'data', so we must ensure 'data.data' is preserved
                if (payload.data && typeof payload.data === 'object') {
                    data.data = { ...data.data, ...payload.data };
                }
            }
        } catch (e) {
            console.error('[SW] Error parsing push data, using defaults:', e);
        }
    }

    // [SW-04] PHASE 2 STRICT FIX: CHAT RELIABILITY (Definitive)
    // "Regla de Oro: Todo mensaje de tipo chat DEBE sonar siempre"
    // Detectamos chat message explícitamente para no afectar otras notificaciones.
    const isChat = data.data?.type === 'chat-message' || (data.tag && data.tag.startsWith('chat-'));

    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        tag: data.tag,

        // [SW-04] INVARIANT: Chat ALWAYS vibrates.
        // Forzamos patrón de vibración si es chat.
        vibrate: isChat ? [200, 100, 200] : (data.vibrate || [200, 100, 200]),

        data: data.data,
        actions: data.actions || [],
        requireInteraction: false,

        // [SW-04] INVARIANT: Chat ALWAYS renotifies.
        // Si es chat, ignoramos data.renotify y forzamos true (Anti-Silencio).
        // Si no es chat, respetamos el payload o default true.
        renotify: isChat ? true : (data.renotify ?? true),
    };

    // [SW-01] ZERO BLOCKING UI STRATEGY
    // Paralelizamos totalmente el ACK y la Notificación.
    // El fallo del ACK jamás debe detener el sonido.

    // 2. Delivery ACK (Background - Network)
    // Starts immediately, runs in parallel
    const payloadData = data.data as any;
    const ackPromise = (payloadData && payloadData.roomId)
        ? sendDeliveryAck(payloadData)
            .catch(err => {
                console.error(`[SW-v${SW_VERSION}] [PUSH] ACK Fatal Error`, err);
            })
        : Promise.resolve();

    // 3. UI Logic (Show Notification or In-App Message)
    const uiPromise = self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
            const hasVisibleClient = clientList.some(
                (client) =>
                    client.visibilityState === 'visible' &&
                    client.url.startsWith(self.location.origin)
            );

            if (hasVisibleClient) {
                console.log(`[SW-v${SW_VERSION}] [PUSH] App visible - Suppressing native notification`);
                clientList.forEach((client) => {
                    client.postMessage({
                        type: 'IN_APP_NOTIFICATION',
                        payload: data,
                    });
                });
                return;
            }

            return self.registration.showNotification(data.title, options)
                .then(() => console.log(`[SW-v${SW_VERSION}] [PUSH] Notification shown`))
                .catch(err => console.error(`[SW-v${SW_VERSION}] [PUSH] Show failed`, err));
        });

    // 4. Wait for both (Keep SW alive)
    event.waitUntil(Promise.allSettled([uiPromise, ackPromise]));
});

async function sendDeliveryAck(data: any) {
    const { roomId, anonymousId } = data;

    // Validate payload
    if (!roomId || !anonymousId) {
        console.warn('[SW] Cannot send ACK: missing roomId or anonymousId', data);
        return;
    }

    const url = `/api/chats/${roomId}/delivered`;
    const request = new Request(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'x-anonymous-id': anonymousId // Authenticate as recipient
        },
        body: JSON.stringify({}) // ✅ FIX: Explicit empty body to avoid parser errors
    });

    try {
        console.log(`[SW] Sending Delivery ACK for Room ${roomId}`);
        // ✅ FIX: Removed keepalive: true (Redundant in SW, potentially buggy in some contexts)
        const response = await fetch(request.clone());
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        console.log('[SW] Delivery ACK sent successfully');
    } catch (err) {
        console.warn('[SW] Delivery ACK failed (Network/Server), queuing for background sync:', err);
        await deliveryQueue.pushRequest({ request });
    }
}

declare let self: ServiceWorkerGlobalScope;

// ============================================
// ENTERPRISE SERVICE WORKER - v2.0
// Google/Meta-Level Resilience
// ============================================

// CACHE BUSTING: Automatically injected by Vite at build time
// Format: "2.4.0-pro_{timestamp}"
const SW_VERSION = __SW_VERSION__;
console.log(`[SW] Initializing Version: ${SW_VERSION}`);
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24h
const NETWORK_TIMEOUT = 15000;

// BroadcastChannel for SW ↔ UI communication
const swChannel = new BroadcastChannel('safespot-sw-updates');

// ===========================================
// CACHE MANAGER (Staleness + Integrity)
// ===========================================

interface CachedEntry {
    response: Response;
    timestamp: number;
    url: string;
}

class CacheManager {
    private cacheName: string;

    constructor(cacheName: string) {
        this.cacheName = cacheName;
    }

    async get(request: Request): Promise<CachedEntry | null> {
        const cache = await caches.open(this.cacheName);
        const response = await cache.match(request);

        if (!response) return null;

        // Try to get timestamp from custom header
        const timestampStr = response.headers.get('x-sw-cached-at');
        const timestamp = timestampStr ? parseInt(timestampStr) : Date.now();

        return { response, timestamp, url: request.url };
    }

    async put(request: Request, response: Response): Promise<void> {
        const cache = await caches.open(this.cacheName);

        // Clone and add timestamp header
        const headers = new Headers(response.headers);
        headers.set('x-sw-cached-at', String(Date.now()));
        headers.set('x-sw-version', SW_VERSION);

        const cachedResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });

        await cache.put(request, cachedResponse);
    }

    isCacheFresh(cached: CachedEntry): boolean {
        const age = Date.now() - cached.timestamp;

        if (age > MAX_CACHE_AGE) {
            console.warn(`[SW] Cache stale (${Math.floor(age / 1000)}s > 24h)`);
            return false;
        }

        return true;
    }

    getCacheAge(cached: CachedEntry): number {
        return Date.now() - cached.timestamp;
    }
}

// ===========================================
// NETWORK FIRST WITH SEMANTIC FALLBACK
// ===========================================

interface NetworkFirstOptions {
    cacheName: string;
    networkTimeout?: number;
    maxCacheAge?: number;
}

/**
 * createNetworkFirstHandler
 * 
 * Factory function that creates a Workbox-compatible RouteHandler
 * with enterprise-grade NetworkFirst + Semantic Fallback strategy
 * 
 * @param options - Configuration options
 * @returns RouteHandler compatible with registerRoute()
 */
function createNetworkFirstHandler(options: NetworkFirstOptions) {
    const cacheManager = new CacheManager(options.cacheName);
    const networkTimeout = options.networkTimeout || NETWORK_TIMEOUT;

    // Helper: Add semantic headers
    function addSemanticHeaders(response: Response, meta: any): Response {
        const headers = new Headers(response.headers);

        // CRITICAL HEADERS for React Query
        headers.set('x-from-cache', String(meta.fromCache));
        headers.set('x-cache-age', String(meta.cacheAge));
        headers.set('x-sw-strategy', meta.strategy);
        headers.set('x-fetch-duration', String(meta.duration));
        headers.set('x-sw-version', SW_VERSION);

        if (meta.fallbackReason) {
            headers.set('x-fallback-reason', meta.fallbackReason);
            headers.set('x-retryable', String(meta.retryable));
        }

        if (meta.cacheFresh !== undefined) {
            headers.set('x-cache-fresh', String(meta.cacheFresh));
        }

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    }

    // Helper: Create error response
    function createErrorResponse(opts: any): Response {
        const body = JSON.stringify({
            error: opts.message,
            retryable: opts.retryable,
            cachedDataAvailable: opts.cachedDataAvailable,
            swVersion: SW_VERSION,
        });

        const headers = new Headers({
            'Content-Type': 'application/json',
            'x-retryable': String(opts.retryable),
            'x-sw-version': SW_VERSION,
        });

        return new Response(body, {
            status: opts.status,
            statusText: opts.message,
            headers,
        });
    }

    // Helper: Broadcast cache update
    function broadcastCacheUpdate(url: string): void {
        try {
            swChannel.postMessage({
                type: 'CACHE_UPDATED',
                url,
                timestamp: Date.now(),
                action: 'invalidate',
            });
        } catch (error) {
            console.error('[SW] BroadcastChannel failed:', error);
        }
    }

    // Return Workbox-compatible RouteHandler
    return async ({ request }: { request: Request }): Promise<Response> => {
        const startTime = Date.now();

        // 1. Get from cache (instant)
        const cached = await cacheManager.get(request);

        // 2. Network race with timeout
        const networkPromise = fetch(request, { cache: 'no-store' });
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), networkTimeout);
        });

        try {
            const networkResponse = await Promise.race([networkPromise, timeoutPromise]);

            // Network SUCCESS
            if (networkResponse.ok) {
                // Update cache in background
                cacheManager.put(request, networkResponse.clone()).catch(console.error);

                // P0 FIX: STOP THE DEATH LOOP
                // Only broadcast CACHE_UPDATED for non-GET requests (mutations)
                // GET requests should rely on SSE for real-time or manual refresh
                if (request.method !== 'GET') {
                    broadcastCacheUpdate(request.url);
                }

                return addSemanticHeaders(networkResponse, {
                    strategy: 'network',
                    duration: Date.now() - startTime,
                    fromCache: false,
                    cacheAge: 0,
                });
            }

            // Network ERROR (4xx/5xx)
            throw new Error(`HTTP ${networkResponse.status}`);
        } catch (error: any) {
            // Network TIMEOUT or ERROR

            const isTimeout = error.message === 'timeout';
            const reason = isTimeout ? 'timeout' : 'network-error';

            console.warn(`[SW] Network failed (${reason}) for ${request.url}`);

            // FALLBACK: Serve cached if available and fresh
            if (cached) {
                const isFresh = cacheManager.isCacheFresh(cached);
                const cacheAge = cacheManager.getCacheAge(cached);

                return addSemanticHeaders(cached.response, {
                    strategy: 'cache-fallback',
                    duration: Date.now() - startTime,
                    fromCache: true,
                    cacheAge,
                    fallbackReason: reason,
                    retryable: isTimeout, // Timeout → retryable
                    cacheFresh: isFresh,
                });
            }

            // NO CACHE: Return error with retry hints
            return createErrorResponse({
                status: 503,
                message: `Network ${reason}`,
                retryable: isTimeout,
                cachedDataAvailable: false,
            });
        }
    };
}

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

            // CRITICAL FIX: Force reload all clients to use new SW
            // This ensures users see the new version immediately
            clients.forEach((client) => {
                client.postMessage({ type: 'FORCE_RELOAD' });
            });
        })()
    );
});

// Listen for SKIP_WAITING message
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

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
const apiStrategy = createNetworkFirstHandler({
    cacheName: 'safespot-api-v2',
    networkTimeout: NETWORK_TIMEOUT,
    maxCacheAge: MAX_CACHE_AGE,
});

registerRoute(
    ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
    apiStrategy
);

// D. Mutations: NetworkOnly with BackgroundSync
const bgSyncPlugin = new BackgroundSyncPlugin('safespot-mutations-queue', {
    maxRetentionTime: 24 * 60, // 24 hours
});

type HTTPMethod = 'POST' | 'PUT' | 'DELETE' | 'PATCH';

(['POST', 'PUT', 'DELETE', 'PATCH'] as HTTPMethod[]).forEach((method) => {
    registerRoute(
        ({ url }) => url.pathname.startsWith('/api/'),
        new NetworkOnly({
            plugins: [bgSyncPlugin],
        }),
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
