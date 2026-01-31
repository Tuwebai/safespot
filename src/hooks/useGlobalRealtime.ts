import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { viewReconciliationEngine } from '@/lib/view-reconciliation/ViewReconciliationEngine';
import { realtimeOrchestrator } from '@/lib/realtime/RealtimeOrchestrator';
import { useToast } from '@/components/ui/toast/useToast';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Global Realtime Hook
 * 
 * Manages the "always-on" connection for the current user.
 * Handles:
 * - Incoming Chat Messages (while in other parts of the app)
 * - Global Alerts
 * - Friend Requests
 */
export function useGlobalRealtime(userId: string | undefined, enabled = true) {
    const queryClient = useQueryClient();
    const toast = useToast(); // Get the whole object to access methods
    const location = useLocation();
    const navigate = useNavigate();
    useEffect(() => {
        if (!userId || !enabled) return;


        // 👑 NEW: Subscription to Motor 10 (View Reconciliation) for Visual Logic
        const unsubReconciliation = viewReconciliationEngine.onVisualIntent((reaction) => {
            const { type, payload } = reaction;

            if (type === 'toast') {
                // Invalidate query to update badge count
                queryClient.invalidateQueries({ queryKey: ['unread-messages'] });

                // Show In-App Toast
                const senderAlias = payload.message?.sender_alias || payload.senderAlias || 'Usuario';
                toast.info(`💬 ${senderAlias}: ${payload.message?.content || payload.content}`);
            } else if (type === 'alert') {
                toast.error(`⚠️ ${payload.message || 'Alerta de seguridad'}`, 10000);
            }
        });

        // 3. Service Worker Bridge (Deduplication)
        const handleSWMessage = async (event: MessageEvent) => {
            if (event.data?.type === 'CHECK_EVENT_PROCESSED') {
                const eventId = event.data.eventId;
                const isProcessed = await realtimeOrchestrator.isEventProcessed(eventId);

                if (event.ports && event.ports[0]) {
                    event.ports[0].postMessage({ processed: isProcessed });
                }
            }
        };

        window.navigator.serviceWorker?.addEventListener('message', handleSWMessage);

        return () => {
            unsubReconciliation();
            window.navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
        };
    }, [userId, enabled, queryClient, toast, location, navigate]);
}
