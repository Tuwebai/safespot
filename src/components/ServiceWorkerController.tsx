
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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
                // Here we could trigger a toast if needed, though
                // usually standard SSE handles this. This is a fallback.
            }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);

        return () => {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
        };
    }, [navigate]);

    return null;
}
