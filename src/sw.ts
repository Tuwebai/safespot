/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// 🧠 ENTERPRISE: Explicit typing for Service Worker Context
declare const self: ServiceWorkerGlobalScope & { __WB_DISABLE_DEV_LOGS: boolean };
declare const __API_BASE_URL__: string; // 🧠 Injected by Vite

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

    // 3. 🏛️ ENTERPRISE PUSH SUPPRESSION (SSOT)
    // Single authority: PostgreSQL. No MessageChannel, no Redis, no heuristics.
    event.waitUntil(
        (async () => {
            const chatData = data.data || data;
            const messageId = chatData.messageId || chatData.entityId;
            const recipientId = chatData.recipientId;

            // SSOT Check: PostgreSQL is the ONLY truth
            if (messageId) {
                try {
                    const response = await fetch(`${__API_BASE_URL__}/realtime/message-status/${messageId}`, {
                        cache: 'no-store' // Absolute truth from PostgreSQL
                    });
                    if (response.ok) {
                        const status = await response.json();
                        // delivered OR read → SUPPRESS
                        if (status.delivered === true || status.read === true) {
                            console.log(`[SW] 🔕 Message ${messageId} already delivered/read (SSOT). Suppressing Push.`);
                            return;
                        }
                    }
                } catch (e) {
                    // FAIL-OPEN: If we can't check, show Push (better duplicate than miss)
                    console.warn('[SW] ⚠️ PostgreSQL status check failed, showing Push (fail-open).', e);
                }
            }

            // 🏛️ WHATSAPP-GRADE: ACK mínimo para Push (delivered = llegó al dispositivo)
            // El SW SOLO confirma recepción, NO hace lógica de dominio
            // Orchestrator sigue siendo autoridad para SSE (app abierta)
            if ((chatData.type === 'chat' || data.type === 'chat') && messageId && recipientId) {
                // Fire-and-forget ACK: NO retry, NO lógica, NO persistencia
                fetch(`${__API_BASE_URL__}/chats/messages/${messageId}/ack-delivered`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Anonymous-Id': recipientId
                    }
                }).then(() => {
                    console.log(`[SW] 📬📬 Push ACK sent for message: ${messageId}`);
                }).catch(() => {
                    // Silently fail - Orchestrator will ACK when app opens
                    console.warn(`[SW] Push ACK failed for ${messageId} (will retry on app open)`);
                });
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
    const notification = event.notification;
    const action = event.action;
    const data = notification.data || {};
    const urlToOpen = data.deepLink || data.url || '/'; // 🚀 Priority: deepLink -> url -> root

    console.log(`[SW] 🖱️ Notification Clicked. Action: ${action || 'default'}, URL: ${urlToOpen}`);

    // Standard dismiss action
    if (action === 'dismiss') {
        notification.close();
        return;
    }

    // 🧠 ENTERPRISE: Handle Reply Action (Inline)
    if (action === 'reply') {
        const replyText = event.reply;
        if (replyText) {
            console.log(`[SW] 💬 Inline Reply received: "${replyText}"`);
            // Note: Inline reply handling usually requires opening the client
            // to process the message in a stateful way, but the ACK is already sent.
        }
    }

    notification.close();

    event.waitUntil(
        (async () => {
            const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

            // 1. Try to find existing window with exactly that URL or any other window to re-use
            let chatClient = null;
            for (const client of allClients) {
                // If it's already on the target URL, prioritize it
                if (client.url.includes(urlToOpen)) {
                    chatClient = client;
                    break;
                }
                // Fallback: use any client from our origin
                if (client.url.includes(self.location.origin)) {
                    chatClient = client;
                }
            }

            if (chatClient && 'focus' in chatClient) {
                await chatClient.focus();
                // Send command to Navigate
                chatClient.postMessage({
                    type: 'NAVIGATE_TO',
                    url: urlToOpen,
                    replyText: action === 'reply' ? event.reply : undefined
                });
                return;
            }

            // 2. Open new window if no client found
            if (self.clients.openWindow) {
                await self.clients.openWindow(urlToOpen);
            }
        })()
    );
});

// ============================================
// 6. SUBSCRIPTION ROTATION (Auto-Repair)
// ============================================

self.addEventListener('pushsubscriptionchange', (event: any) => {
    console.log('[SW] 🔄 Push subscription expired or changed. Repairing...');

    event.waitUntil(
        (async () => {
            try {
                const response = await fetch(`${__API_BASE_URL__}/push/vapid-key`);
                const { publicKey } = await response.json();

                if (!publicKey) throw new Error('No VAPID key for repair');

                const newSubscription = await self.registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicKey)
                });

                console.log('[SW] ✅ New subscription obtained. Syncing with backend...');

                await fetch(`${__API_BASE_URL__}/push/subscribe`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // Note: anonymousId will be handled by the backend middleware if 
                        // we can recover it, or we might need it from IndexedDB.
                        // For now, let's assume the backend identify the device by endpoint if possible,
                        // or we rely on the next app boot to fix the ID link.
                    },
                    body: JSON.stringify({
                        subscription: newSubscription,
                        repair: true
                    })
                });

                console.log('[SW] 🚀 Push subscription auto-repaired successfully.');
            } catch (err) {
                console.error('[SW] ❌ Failed to repair push subscription:', err);
            }
        })()
    );
});

// Helper for VAPID conversion inside SW
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
