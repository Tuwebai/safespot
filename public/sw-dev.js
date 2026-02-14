// Service Worker de Desarrollo - Versión simplificada para DEV ONLY
const SW_VERSION = 'dev-v1';

console.log(`[SW-DEV] Initializing ${SW_VERSION}`);

// Install
self.addEventListener('install', (event) => {
    console.log('[SW-DEV] Installing...');
    self.skipWaiting();
});

// Activate
self.addEventListener('activate', (event) => {
    console.log('[SW-DEV] Activated');
    event.waitUntil(self.clients.claim());
});

// ============================================
// PUSH NOTIFICATIONS
// ============================================

self.addEventListener('push', (event) => {
    console.log('[SW-DEV] 📥 Push received:', event);
    
    let data = {};
    try {
        data = event.data?.json() || {};
    } catch (e) {
        console.warn('[SW-DEV] Push parse error:', e);
    }
    
    const title = data.title || '🔔 SafeSpot';
    const options = {
        body: data.body || data.message || 'Nueva notificación',
        icon: data.icon || '/icon-192x192.png',
        badge: data.badge || '/badge-72x72.png',
        tag: data.tag || 'default',
        requireInteraction: true,
        data: data.data || { url: '/' }
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Click en notificación
self.addEventListener('notificationclick', (event) => {
    console.log('[SW-DEV] Notification clicked:', event);
    event.notification.close();
    
    const url = event.notification.data?.url || '/';
    
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clientList) => {
            // Si hay una ventana abierta, enfocarla
            for (const client of clientList) {
                if (client.url === url && 'focus' in client) {
                    return client.focus();
                }
            }
            // Si no, abrir nueva
            if (self.clients.openWindow) {
                return self.clients.openWindow(url);
            }
        })
    );
});

// ============================================
// FALLBACK: Fetch (Network only en dev)
// ============================================

self.addEventListener('fetch', (event) => {
    // En dev, dejamos que todo pase al network
    // El SW solo existe para recibir push notifications
});

console.log('[SW-DEV] ✅ Ready for push notifications');
