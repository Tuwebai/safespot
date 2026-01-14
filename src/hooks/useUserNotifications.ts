import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAnonymousIdSafe } from '@/lib/identity';
import { API_BASE_URL } from '@/lib/api';
import { upsertInList } from '@/lib/realtime-utils';
import { NOTIFICATIONS_QUERY_KEY } from './queries/useNotificationsQuery';
import { ssePool } from '@/lib/ssePool';

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

        // Helper to handle incoming notifications
        const handleEvent = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data) as NotificationPayload;

                // 1. Patch notifications list if full object is provided
                if (data.notification) {
                    upsertInList(queryClient, NOTIFICATIONS_QUERY_KEY, data.notification);

                    // 1.5 Play sound for new notification
                    const notified = JSON.parse(localStorage.getItem('safespot_seen_sse_ids') || '[]');
                    if (!notified.includes(data.notification.id)) {
                        import('./useBadgeNotifications').then(({ playBadgeSound }) => playBadgeSound());
                        notified.push(data.notification.id);
                        if (notified.length > 50) notified.shift();
                        localStorage.setItem('safespot_seen_sse_ids', JSON.stringify(notified));
                    }
                }

                // 2. Handle specific types with atomic patches
                // NOTE: 'achievement' type no longer triggers badge check here.
                // The toast comes from action response's newBadges array (e.g. useCreateReportForm).
                // SSE only adds notification to list via upsertInList above.

                if (data.type === 'follow') {
                    queryClient.invalidateQueries({ queryKey: ['users', 'public', 'profile'] });
                }

                if (onNotification) onNotification(data);
            } catch (err) {
                console.error('[SSE] Error parsing notification:', err);
            }
        };

        // Listen for 'notification' events
        const unsubscribe = ssePool.subscribe(url, 'notification', (event) => {
            handleEvent(event as MessageEvent);
        });

        // Also listen for 'presence-update' for global reactivity
        const unsubscribePresence = ssePool.subscribe(url, 'presence-update', (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.userId) {
                    queryClient.setQueryData(['users', 'presence', data.userId], data.partial);
                }
            } catch (e) { }
        });

        return () => {
            unsubscribe();
            unsubscribePresence();
        };
    }, [anonymousId, queryClient, onNotification]);
}
