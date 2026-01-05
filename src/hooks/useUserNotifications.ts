
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAnonymousIdSafe } from '@/lib/identity';
import { API_BASE_URL } from '@/lib/api';

interface NotificationPayload {
    type: string;
    followerId?: string;
    followerAlias?: string;
    // Add other payload types as needed
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
                console.log('[SSE] Notification received:', data);

                // Global handling (e.g., invalidate queries)
                if (data.type === 'follow') {
                    // Update profile queries if meaningful
                    // Note: This listens to notifications for ME.
                    // If I am looking at MY public profile, I want updates.
                    // If I am looking at someone else's profile, I don't get their notifications.
                    // WAIT. 
                    // The user said: "if someone follows ME, I don't get notification".
                    // So this hook listening to MY events is correct.

                    // Invalidate my notification count / bell
                    queryClient.invalidateQueries({ queryKey: ['notifications'] });

                    // Also invalidate self profile query if active
                    queryClient.invalidateQueries({ queryKey: ['users', 'public', 'profile'] });
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
