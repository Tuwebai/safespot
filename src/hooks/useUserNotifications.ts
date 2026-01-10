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

                    // 1.5 Play sound for new notification (if it's a new entry)
                    // We check if it's new because SSE might resend on reconnect
                    const notified = JSON.parse(localStorage.getItem('safespot_seen_sse_ids') || '[]');
                    if (!notified.includes(data.notification.id)) {
                        import('./useBadgeNotifications').then(({ playBadgeSound }) => playBadgeSound());
                        notified.push(data.notification.id);
                        if (notified.length > 50) notified.shift();
                        localStorage.setItem('safespot_seen_sse_ids', JSON.stringify(notified));
                    }
                }

                // 2. Handle specific types with atomic patches
                if (data.type === 'achievement') {
                    // Trigger immediate check to show the badge unlock UI
                    import('./useBadgeNotifications').then(({ triggerBadgeCheck }) => {
                        triggerBadgeCheck();
                    });
                }

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
