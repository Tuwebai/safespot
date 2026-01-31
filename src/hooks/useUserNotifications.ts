import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAnonymousIdSafe } from '@/lib/identity';
import { API_BASE_URL } from '@/lib/api';
import { upsertInList } from '@/lib/realtime-utils';
import { NOTIFICATIONS_QUERY_KEY } from './queries/useNotificationsQuery';
import { ssePool } from '@/lib/ssePool';
import { useEventDeduplication } from './useEventDeduplication';
import { getClientId } from '@/lib/clientId';

// ... (inside component)



interface NotificationPayload {
    id?: string; // Add ID field if possible from backend
    eventId?: string; // Deterministic event ID
    originClientId?: string; // To avoid self-notifying
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
    const { shouldProcess } = useEventDeduplication();
    const myClientId = getClientId();

    useEffect(() => {
        if (!anonymousId) return;

        const url = `${API_BASE_URL}/realtime/user/${anonymousId}`;

        // ============================================
        // GAP RECOVERY: On SSE Reconnection
        // ============================================
        const unsubReconnect = ssePool.onReconnect(url, async () => {
            try {
                console.debug('[Notifications] SSE reconnected, fetching missed notifications...');

                // Import dynamically to avoid circular deps
                const { notificationsApi } = await import('@/lib/api');
                const freshNotifications = await notificationsApi.getAll();

                if (freshNotifications && freshNotifications.length > 0) {
                    console.debug(`[Notifications] ✅ Recovered ${freshNotifications.length} notifications`);
                    // Replace entire list with fresh data (dedup not needed - full refresh)
                    queryClient.setQueryData(
                        ['notifications', 'list', anonymousId],
                        freshNotifications
                    );
                }
            } catch (err) {
                console.error('[Notifications] Gap recovery failed:', err);
                // Fallback: invalidate to trigger React Query refetch
                queryClient.invalidateQueries({
                    queryKey: ['notifications', 'list', anonymousId]
                });
            }
        });

        // Helper to handle incoming notifications
        const handleEvent = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data) as NotificationPayload;

                // 🏛️ ENTERPRISE GUARD: Deduplication & Origin Check
                // 1. Origin check: Don't process events I triggered myself
                if (data.originClientId === myClientId) return;

                // 2. Idempotency check: Process each specific event only once
                // Use data.eventId or data.notification.id or a hash of the content
                const eventId = data.eventId || data.notification?.id;
                if (!shouldProcess(eventId, 'Notification')) return;

                // 1. Patch notifications list if full object is provided
                if (data.notification) {
                    upsertInList(queryClient, NOTIFICATIONS_QUERY_KEY, data.notification);

                    // 1.5 Play sound for new notification
                    // 🏛️ ENTERPRISE FIX: Skip sound for 'badge' type here, as useBadgeNotifications handles it
                    const isBadgeNotification = data.notification.type === 'badge';

                    const notified = JSON.parse(localStorage.getItem('safespot_seen_sse_ids') || '[]');
                    if (!notified.includes(data.notification.id) && !isBadgeNotification) {
                        import('./useBadgeNotifications').then(({ playBadgeSound }) => playBadgeSound());
                        notified.push(data.notification.id);
                        if (notified.length > 50) notified.shift();
                        localStorage.setItem('safespot_seen_sse_ids', JSON.stringify(notified));
                    }

                    // Trigger badge check if it's a badge notification to update UI
                    if (isBadgeNotification) {
                        import('./useBadgeNotifications').then(({ triggerBadgeCheck }) => triggerBadgeCheck());
                    }
                }

                // 2. Handle specific types with atomic patches
                // NOTE: 'achievement' type no longer triggers badge check here.
                // The toast comes from action response's newBadges array (e.g. useCreateReportForm).
                // SSE only adds notification to list via upsertInList above.

                if (data.type === 'notifications-read-all') {
                    queryClient.setQueryData(['notifications', 'list', anonymousId], (old: any) =>
                        Array.isArray(old) ? old.map(n => ({ ...n, is_read: true })) : []
                    );
                }

                if (data.type === 'notifications-deleted-all') {
                    queryClient.setQueryData(['notifications', 'list', anonymousId], []);
                }

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
            unsubReconnect();
            unsubscribe();
            unsubscribePresence();
        };
    }, [anonymousId, queryClient, onNotification]);
}
