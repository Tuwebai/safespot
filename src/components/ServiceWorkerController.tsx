
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

/**
 * ServiceWorkerController
 * 
 * Headless component that listens for messages from the Service Worker
 * and performs actions in the React context (Navigation, Toast, etc.)
 * 
 * @invariant This component MUST be rendered inside a <BrowserRouter>
 */
export function ServiceWorkerController() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();  // ✅ For SW update handling

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
                // Fallback toast for push notifications when app is visible
            }

            // ✅ ENTERPRISE: SW Update Events
            if (type === 'SW_UPDATE_PENDING') {
                console.warn('[ServiceWorkerController] SW update pending, cancelling queries');
                queryClient.cancelQueries();  // Cancel all in-flight queries
            }

            if (type === 'SW_UPDATED') {
                console.log('[ServiceWorkerController] SW updated, invalidating queries');
                queryClient.invalidateQueries();  // Refetch all with new SW
            }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);

        return () => {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
        };
    }, [navigate]);

    return null;
}
