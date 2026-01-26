import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/api';
import { ssePool } from '@/lib/ssePool';
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
    const processedEvents = useRef(new Set<string>());

    useEffect(() => {
        if (!userId || !enabled) return;

        const url = `${API_BASE_URL}/realtime/user/${userId}`;
        const myClientId = getClientId();

        const shouldProcess = (eventId?: string) => {
            if (!eventId) return true;
            if (processedEvents.current.has(eventId)) return false;
            processedEvents.current.add(eventId);
            return true;
        };

        // 1. New Message Notification
        const unsubMessage = ssePool.subscribe(url, 'new-message', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);
                if (data.originClientId === myClientId) return;

                // Don't show toast if we are already in the chat room!
                const isInRoom = location.pathname.includes(`/mensajes/${data.roomId}`);
                if (isInRoom) return;

                if (!shouldProcess(data.eventId)) return;

                // Invalidate query to update badge count if we have one
                queryClient.invalidateQueries({ queryKey: ['unread-messages'] });

                // Show In-App Toast instead of Push
                // Note: Current Toast lib only supports string messages, no actions.
                toast.info(`💬 ${data.senderAlias || 'Usuario'}: ${data.content}`);

            } catch (err) {
                console.error('[SSE Global] Error processing new-message:', err);
            }
        });

        // 2. Global Alert (Security/Admin)
        const unsubAlert = ssePool.subscribe(url, 'security-alert', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);
                toast.error(`⚠️ ${data.message}`, 10000); // 10s duration
            } catch (err) {
                console.error('[SSE Global] Error processing alert:', err);
            }
        });

        return () => {
            unsubMessage();
            unsubAlert();
        };
    }, [userId, enabled, queryClient, toast, location, navigate]);
}
