/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// 🧠 ENTERPRISE: Explicit typing for Service Worker Context
declare const self: ServiceWorkerGlobalScope & { __WB_DISABLE_DEV_LOGS: boolean };

// @ts-ignore - Silence Workbox logs
self.__WB_DISABLE_DEV_LOGS = true;

// ============================================
// ENTERPRISE SERVICE WORKER - v2.2 (Robust)
// ============================================

const SW_VERSION = 'v2.2-robust';
console.log(`[SW] Initializing Version: ${SW_VERSION}`);

// ============================================
// 1. LIFECYCLE
// ============================================

self.addEventListener('install', (_event) => {
    console.log(`[SW] ${SW_VERSION} Installing...`);
    // Client controls activation
});

self.addEventListener('activate', (event) => {
    console.log(`[SW] ${SW_VERSION} Activated`);
    event.waitUntil(
        (async () => {
            await self.clients.claim();

            // AGGRESSIVE CLEANUP: Remove old custom caches
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(async (name) => {
                    const VALID_CACHES = ['safespot-images', 'safespot-static-assets'];
                    // Note: Workbox precaches are managed by cleanupOutdatedCaches()
                    if (name.startsWith('safespot-') && !VALID_CACHES.includes(name)) {
                        console.log('[SW] Deleting old cache:', name);
                        await caches.delete(name);
                    }
                })
            );

            cleanupOutdatedCaches();
        })()
    );
});

// ============================================
// 2. PRECACHE & ROUTING
// ============================================

// @ts-ignore
precacheAndRoute(self.__WB_MANIFEST || []);

// ============================================
// 3. RUNTIME CACHING STRATEGIES
// ============================================

// Images: StaleWhileRevalidate (Low Risk)
registerRoute(
    ({ request }) => request.destination === 'image',
    new StaleWhileRevalidate({
        cacheName: 'safespot-images',
        plugins: [
            new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }), // 30 Days
        ],
    })
);

// Static Assets (Fonts/Styles): CacheFirst (Long Term)
registerRoute(
    ({ request }) => request.destination === 'font' || request.destination === 'style',
    new CacheFirst({
        cacheName: 'safespot-static-assets',
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 }),
        ],
    })
);

// API Calls: Network Only (Absolute Truth)
registerRoute(
    ({ url }) => url.pathname.startsWith('/api/'),
    new NetworkOnly()
);

// Navigation: Network First -> Offline Fallback
const navigationHandler = async (params: { request: Request }) => {
    try {
        // Force bypass browser cache for HTML to avoid stale chunks
        const response = await fetch(params.request, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
        });
        return response;
    } catch (error) {
        // Minimal Offline Page
        return new Response(
            '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Sin Conexión - SafeSpot</title><style>body{background:#020617;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;margin:0;padding:20px;text-align:center}h1{color:#4ade80;margin-bottom:1rem}p{max-width:400px;line-height:1.5}</style></head><body><h1>⚠️ Sin Conexión</h1><p>No pudimos conectar con los servidores de SafeSpot.</p><p>Verifica tu conexión a internet e intenta recargar.</p><button onclick="window.location.reload()" style="margin-top:20px;padding:12px 24px;border-radius:8px;border:none;background:#22c55e;color:black;font-weight:bold;cursor:pointer">Recargar</button></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
        );
    }
};

registerRoute(
    new NavigationRoute(navigationHandler, {
        denylist: [/^\/api\//, /\.[a-z]+$/i],
    })
);

// ============================================
// 4. PUSH EVENTS (Pure Passthrough with Intelligent Dedup)
// ============================================

interface PushEvent extends Event {
    data: {
        json(): any;
        text(): string;
    } | null;
    waitUntil(promise: Promise<any>): void;
}

self.addEventListener('push', (event: any) => {
    const pushEvent = event as PushEvent;
    console.log('[SW] 📥 Push Event received', pushEvent);

    let data: any = {};
    let isPayloadValid = false;

    // 1. Defensively parsing
    try {
        if (pushEvent.data) {
            data = pushEvent.data.json();
            isPayloadValid = true;
        }
    } catch (e) {
        console.warn('[SW] Push parse error', e);
    }

    // 2. Normalize Defaults (Fail-safe)
    const title = data?.title || 'SafeSpot: Nueva Actividad';
    // @ts-ignore - Standard SW props like renotify/vibrate might be missing in strict TS libs
    const options: any = {
        body: data?.body || (isPayloadValid ? 'Tienes una nueva notificación' : 'Revisa la app para ver novedades.'),
        icon: data?.icon || '/icons/icon-192.png',
        badge: data?.badge || '/icons/icon-192.png',
        tag: data?.tag || 'safespot-generic',
        data: data, // Keep raw data for click handler
        // Critical Properties for Delivery
        renotify: true,
        requireInteraction: false,
        vibrate: [200, 100, 200]
    };

    // 3. Dual-Channel Delivery Logic with Global Ledger
    // Strategy: We check if any active client handled it, OR if the Global Ledger says it's delivered.
    event.waitUntil(
        (async () => {
            const eventId = data.eventId || data.data?.eventId || data.data?.messageId;
            const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

            // 3.1 Local Client Check (Fastest)
            if (clientList.length > 0) {
                const checkPromises = clientList.map(client => {
                    return new Promise((resolve) => {
                        const channel = new MessageChannel();
                        channel.port1.onmessage = (msg) => resolve(msg.data?.processed === true);
                        client.postMessage({ type: 'CHECK_EVENT_PROCESSED', eventId }, [channel.port2]);
                        setTimeout(() => resolve(false), 200); // Strict 200ms
                    });
                });
                const results = await Promise.all(checkPromises);
                if (results.some(r => r === true)) {
                    console.log(`[SW] 🔕 Event ${eventId} handled by local client. Suppressing.`);
                    return;
                }
            }

            // 3.2 Global Ledger Check (Single Source of Truth)
            // We fetch the status from the server to ensure consistency even if local clients are frozen.
            if (eventId) {
                try {
                    const response = await fetch(`/api/realtime/status/${eventId}`, {
                        cache: 'no-store' // Absolute truth
                    });
                    if (response.ok) {
                        const status = await response.json();
                        if (status.status === 'delivered') {
                            console.log(`[SW] 🔕 Event ${eventId} marked as DELIVERED in Global Ledger. Suppressing Push.`);
                            return;
                        }
                    }
                } catch (e) {
                    console.warn('[SW] Ledger check failed, falling back to showing notification.', e);
                }
            }

            // If not handled, SHOW IT.
            try {
                await self.registration.showNotification(title, options);
            } catch (e) {
                console.error('[SW] ShowNotification Error:', e);
            }
        })()
    );
});

// ============================================
// 5. NOTIFICATION CLICK (Window Focus Strategy)
// ============================================

self.addEventListener('notificationclick', (event: any) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        (async () => {
            const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

            // 1. Try to find existing window
            for (const client of allClients) {
                if (client.url === urlToOpen || (client.url.includes(self.location.origin) && 'focus' in client)) {
                    await client.focus();
                    if (client.url !== urlToOpen) {
                        client.postMessage({ type: 'NAVIGATE_TO', url: urlToOpen });
                    }
                    return;
                }
            }

            // 2. Open new window
            if (self.clients.openWindow) {
                await self.clients.openWindow(urlToOpen);
            }
        })()
    );
});
