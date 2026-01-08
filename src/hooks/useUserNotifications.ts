import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAnonymousIdSafe } from '@/lib/identity';
import { API_BASE_URL } from '@/lib/api';
import { upsertInList } from '@/lib/realtime-utils';


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

        eventSource.onmessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data) as NotificationPayload;
                // console.log('[SSE] Notification received:', data.type, data);

                // 1. Patch notifications list if full object is provided
                if (data.notification) {
                    upsertInList(queryClient, ['notifications'], data.notification);
                }

                // 2. Handle specific types with atomic patches
                if (data.type === 'follow') {
                    // Refresh profile to reflect new followers
                    queryClient.invalidateQueries({ queryKey: ['users', 'public', 'profile'] });
                }

                // Note: Like/Comment counters for reports are handled by 
                // useGlobalFeed and useRealtimeComments to avoid double increments.

                if (onNotification) {
                    onNotification(data);
                }

            } catch (err) {
                console.error('[SSE] Error parsing notification:', err);
            }
        };

        eventSource.onerror = () => {
            if (eventSource.readyState === EventSource.CLOSED) {
                // Connection closed
            }
        };

        return () => {
            eventSource.close();
        };
    }, [anonymousId, queryClient, onNotification]);
}
