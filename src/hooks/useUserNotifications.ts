import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAnonymousIdSafe } from '@/lib/identity';
import { API_BASE_URL } from '@/lib/api';
import { upsertInList } from '@/lib/realtime-utils';
import { NOTIFICATIONS_QUERY_KEY } from './queries/useNotificationsQuery';

// ... (inside component)



interface NotificationPayload {
    type: string;
    followerId?: string;
    followerAlias?: string;
    reportId?: string;
    entityId?: string;
    targetType?: string;
    title?: string;
    message?: string;
    notification?: any; // The full notification object for patching
}

export function useUserNotifications(onNotification?: (data: NotificationPayload) => void) {
    const queryClient = useQueryClient();
    const anonymousId = getAnonymousIdSafe();

    useEffect(() => {
        if (!anonymousId) return;

        const url = `${API_BASE_URL}/realtime/user/${anonymousId}`;
        const eventSource = new EventSource(url);

        // Helper to handle incoming notifications
        const handleEvent = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data) as NotificationPayload;
                // console.log('[SSE] Notification received:', event.type, data);

                // 1. Patch notifications list if full object is provided
                if (data.notification) {
                    upsertInList(queryClient, NOTIFICATIONS_QUERY_KEY, data.notification);
                }

                // 2. Handle specific types with atomic patches
                if (data.type === 'follow') {
                    // Refresh profile to reflect new followers
                    queryClient.invalidateQueries({ queryKey: ['users', 'public', 'profile'] });
                }

                if (onNotification) {
                    onNotification(data);
                }
            } catch (err) {
                console.error('[SSE] Error parsing notification:', err);
            }
        };

        // Listen for 'notification' events (Standardized Backend Event)
        eventSource.addEventListener('notification', handleEvent);

        // Also listen for 'message' just in case
        eventSource.onmessage = handleEvent;

        eventSource.onerror = () => {
            if (eventSource.readyState === EventSource.CLOSED) {
                // Connection closed
            }
        };

        eventSource.onerror = () => {
            if (eventSource.readyState === EventSource.CLOSED) {
                // Connection closed
            }
        };

        return () => {
            eventSource.removeEventListener('notification', handleEvent);
            eventSource.close();
        };
    }, [anonymousId, queryClient, onNotification]);
}
