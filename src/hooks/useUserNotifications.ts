
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAnonymousIdSafe } from '@/lib/identity';
import { API_BASE_URL } from '@/lib/api';

interface NotificationPayload {
    type: string;
    followerId?: string;
    followerAlias?: string;
    reportId?: string; // ID of the report involved (for likes, comments, mentions)
    entityId?: string;
    targetType?: string;
    title?: string;
    message?: string;
}

export function useUserNotifications(onNotification?: (data: NotificationPayload) => void) {
    const queryClient = useQueryClient();
    const anonymousId = getAnonymousIdSafe();

    useEffect(() => {
        if (!anonymousId) return;

        const url = `${API_BASE_URL}/realtime/user/${anonymousId}`;
        const eventSource = new EventSource(url);

        eventSource.onopen = () => {
            console.log('[SSE] User Notifications Connected');
        };

        eventSource.addEventListener('notification', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data) as NotificationPayload;
                console.log('[SSE] Notification received:', data.type, data);

                // 1. Always invalidate notifications list (update bell count)
                queryClient.invalidateQueries({ queryKey: ['notifications'] });

                // 2. Handle specific types
                if (data.type === 'follow') {
                    // Update profile stats
                    queryClient.invalidateQueries({ queryKey: ['users', 'public', 'profile'] });
                }

                // 3. Update Report/Comments if reportId is present (Likes, Comments, Mentions)
                // This ensures that if I'm viewing the report, the like count or comments update instantly.
                if (data.reportId) {
                    queryClient.invalidateQueries({ queryKey: ['reports', data.reportId] });
                    queryClient.invalidateQueries({ queryKey: ['comments', data.reportId] });

                    // Also invalidate global feed stats if needed? 
                    // Maybe overkill to invalidate 'reports' list, but individual report cache is good.
                }

                // Custom callback
                if (onNotification) {
                    onNotification(data);
                }

            } catch (err) {
                console.error('[SSE] Error parsing notification:', err);
            }
        });

        eventSource.onerror = () => {
            // console.error('[SSE] Connection error:', err);
            eventSource.close();
            // Reconnect logic is usually handled by browser or simple wrapper, 
            // but for now we rely on browser's native reconnection for EventSource usually? 
            // Actually native EventSource auto-reconnects.
        };

        return () => {
            eventSource.close();
        };
    }, [anonymousId, queryClient, onNotification]);
}
