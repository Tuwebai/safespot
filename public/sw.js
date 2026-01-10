/**
 * Service Worker Placeholder
 * 
 * In development, Vite injects the SW via 'vite-plugin-pwa'.
 * However, if browsers request /sw.js directly and it's missing,
 * the SPA fallback returns HTML, causing a MIME type error.
 * 
 * This empty file ensures a valid JS response is always returned,
 * preventing console errors and "SecurityError".
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
