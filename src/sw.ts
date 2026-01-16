/// <reference lib="webworker" />
// @ts-ignore - Silence Workbox logs
self.__WB_DISABLE_DEV_LOGS = true;

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

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
                    if (!cacheName.includes(SW_VERSION)) {
                        console.log('[SW] Deleting old cache:', cacheName);
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

// A. Images: StaleWhileRev alidate
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
const navigationRoute = new NavigationRoute(
    async ({ request }) => {
        const TIMEOUT = 2000;

        // CRITICAL FIX: Always fetch HTML from network, NEVER cache
        // This prevents stale HTML from being served after deploys
        const networkPromise = fetch(request, {
            cache: 'no-store',  // Prevent browser cache
            headers: { 'Cache-Control': 'no-cache' }  // Force revalidation
        });

        const timeoutPromise = new Promise<Response>((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), TIMEOUT);
        });

        try {
            const response = await Promise.race([networkPromise, timeoutPromise]);
            if (response.ok) {
                // CRITICAL: Do NOT cache HTML
                // Old code: cache.put(request, response.clone());
                return response;  // Serve fresh HTML directly
            }
            throw new Error(`Response not ok: ${response.status}`);
        } catch (error) {
            // OFFLINE FALLBACK: Show offline page, NOT stale HTML
            // This prevents serving old version when network fails
            console.warn('[SW] HTML navigation failed, showing offline page');
            return new Response(
                '<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>Sin conexión</h1><p>Por favor, verifica tu conexión a internet.</p></body></html>',
                {
                    status: 503,
                    headers: { 'Content-Type': 'text/html' }
                }
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

self.addEventListener('push', (event) => {
    console.log('[SW] Push received:', event);

    let data = {
        title: '⚠️ Nuevo reporte cerca tuyo',
        body: 'Hay actividad en tu zona',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'safespot-notification',
        data: { url: '/mapa' },
        actions: [],
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
        requireInteraction: false,
    };

    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                const hasVisibleClient = clientList.some(
                    (client) =>
                        client.visibilityState === 'visible' &&
                        client.url.startsWith(self.location.origin)
                );

                if (hasVisibleClient) {
                    console.log('[SW] App visible - Suppressing native notification');
                    clientList.forEach((client) => {
                        client.postMessage({
                            type: 'IN_APP_NOTIFICATION',
                            payload: data,
                        });
                    });
                    return;
                }

                return self.registration.showNotification(data.title, options);
            })
    );
});

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
