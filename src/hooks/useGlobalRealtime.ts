import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { realtimeOrchestrator } from '@/lib/realtime/RealtimeOrchestrator';
import { useToast } from '@/components/ui/toast/useToast';
import { getClientId } from '@/lib/clientId';
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

        const myClientId = getClientId();

        // 👑 NEW: Unified Orchestrator Authority for Global Events
        const unsubOrchestrator = realtimeOrchestrator.onEvent((event) => {
            const { type, payload } = event;

            if (type === 'new-message') {
                if (payload.originClientId === myClientId) return;

                // Don't show toast if we are already in the chat room!
                const isInRoom = location.pathname.includes(`/mensajes/${payload.message?.conversation_id}`);
                if (isInRoom) return;

                // Invalidate query to update badge count if we have one
                queryClient.invalidateQueries({ queryKey: ['unread-messages'] });

                // Show In-App Toast
                const senderAlias = payload.message?.sender_alias || payload.senderAlias || 'Usuario';
                toast.info(`💬 ${senderAlias}: ${payload.message?.content || payload.content}`);
            } else if (type === 'security-alert' || type === 'activity') {
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
            unsubOrchestrator();
            window.navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
        };
    }, [userId, enabled, queryClient, toast, location, navigate]);
}
