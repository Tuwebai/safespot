import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import { playNotificationSound } from '../lib/sound';

/**
 * ServiceWorkerController
 * 
 * Headless component that listens for messages from the Service Worker
 * and performs actions in the React context (Navigation, Toast, etc.)
 * 
 * @invariant This component MUST be rendered inside a <BrowserRouter>
 * 
 * NOTE: useAppVersionGuard removed - silent updates handled by UpdateManager
 */
export function ServiceWorkerController() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const toast = useToast();

    // ✅ ENTERPRISE: Auth Sync to Service Worker (IDB)
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const syncAuthToSw = async () => {
            try {
                const storedAuth = localStorage.getItem('auth-storage');
                if (!storedAuth) return;

                const parsed = JSON.parse(storedAuth);
                const rawToken = parsed?.state?.token;
                if (!rawToken || typeof rawToken !== 'object') return;

                const token = {
                    anonymousId: rawToken.anonymousId || rawToken.anonymous_id || '',
                    signature: rawToken.signature || '',
                    jwt: rawToken.jwt || null
                };

                if (!token.anonymousId || !token.signature) {
                    return;
                }

                const message = { type: 'SYNC_AUTH', token };
                console.log('[ServiceWorkerController] Syncing auth to SW', {
                    hasAnonymousId: !!token.anonymousId,
                    hasSignature: !!token.signature,
                    hasJwt: !!token.jwt
                });
                navigator.serviceWorker.controller?.postMessage(message);

                const registration = await navigator.serviceWorker.ready;
                registration.active?.postMessage(message);
                registration.waiting?.postMessage(message);
                registration.installing?.postMessage(message);
            } catch (e) {
                console.error('[ServiceWorkerController] Auth Sync failed:', e);
            }
        };

        syncAuthToSw();
    }, [navigate]); // Re-check on navigation (low cost, ensures freshness)

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const handleMessage = (event: MessageEvent) => {
            const { type, url } = event.data;

            console.log('[ServiceWorkerController] Received message:', type, event.data);

            if (type === 'NAVIGATE_TO' && url) {
                try {
                    // Normalize URL to be relative to avoid full reloads
                    const targetUrl = new URL(url, window.location.origin);
                    const relativePath = targetUrl.pathname + targetUrl.search + targetUrl.hash;

                    console.log('[ServiceWorkerController] Navigating to:', relativePath);
                    navigate(relativePath);
                } catch (e) {
                    console.error('[ServiceWorkerController] Navigation error:', e);
                }
            }

            if (type === 'IN_APP_NOTIFICATION') {
                const payload = event.data.payload; // Correct payload structure
                const notifData = payload.data || {};
                const targetUrl = notifData.url;

                // 1. Play Sound (Always)
                playNotificationSound();

                // 2. Check if we are already in the chat
                const currentPath = window.location.pathname;

                // If we are NOT in the target chat, show toast
                if (targetUrl && currentPath !== targetUrl) {
                    toast.info(`💬 ${payload.title}: ${payload.body}`, 4000);
                }
            }

            // ✅ ENTERPRISE: SW Update Events
            if (type === 'SW_UPDATE_PENDING') {
                console.warn('[ServiceWorkerController] SW update pending, cancelling queries');
                queryClient.cancelQueries();  // Cancel all in-flight queries
            }

            if (type === 'SW_UPDATED') {
                console.log('[ServiceWorkerController] SW updated, invalidating queries');
                // ✅ ENTERPRISE: Soft Update UX - Notify user
                toast.info('Nueva versión disponible. Por favor recarga la página para aplicar cambios.', 10000);
                queryClient.invalidateQueries();  // Refetch all with new SW
            }

            // ✅ ENTERPRISE RULE: INVALID PAYLOAD FALLBACK
            if (type === 'INVALID_PAYLOAD_DETECTED') {
                console.error('[ServiceWorkerController] ⚠️ Malformed Push detected, forcing State Reconciliation', event.data);
                queryClient.invalidateQueries();
            }

            // ✅ BACKGROUND DATA SYNC
            if (type === 'BACKGROUND_DATA_UPDATE') {
                console.log('[ServiceWorkerController] Background data update, refreshing queries');
                queryClient.invalidateQueries();
            }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);

        return () => {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
        };
    }, [navigate, toast, queryClient]);

    return null;
}
