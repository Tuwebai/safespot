
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
 */
export function ServiceWorkerController() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();  // ✅ For SW update handling
    const toast = useToast();

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
                // URL usually looks like /mensajes/:roomId
                // pathname looks like /mensajes/:roomId
                const currentPath = window.location.pathname;

                // If we are NOT in the target chat, show toast
                if (targetUrl && currentPath !== targetUrl) {
                    // Adapter for Custom Toast System (Simple API)
                    // Since we cannot pass actions/title, we append the intent to the message
                    toast.info(`💬 ${payload.title}: ${payload.body}`, 4000);

                    // We can't attach an onClick to the simple toast, 
                    // but the user can click the notification in the system tray if background.
                    // For in-app, we rely on the sound and visual cue.
                    // Ideally, we upgrade the Toast system later to support actions.
                } else {
                    console.log('[SW-Controller] Muted toast (already in chat)');
                }
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
