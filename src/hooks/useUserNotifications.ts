import { useEffect } from 'react';
import { getAnonymousIdSafe } from '@/lib/identity';
import { realtimeOrchestrator } from '@/lib/realtime/RealtimeOrchestrator';
import { getClientId } from '@/lib/clientId';

interface NotificationPayload {
    id?: string;
    eventId?: string;
    originClientId?: string;
    type: string;
    notification?: any;
    [key: string]: any;
}

/**
 * 👑 Unified Passive Sync (USER Domain):
 * useUserNotifications is now a PASSIVE consumer.
 * Subscription, Persistance, and Gap-Recovery are handled by RealtimeOrchestrator.
 */
export function useUserNotifications(onNotification?: (data: NotificationPayload) => void) {
    const anonymousId = getAnonymousIdSafe();
    const myClientId = getClientId();

    useEffect(() => {
        if (!anonymousId) return;

        // Subscribe to the Orchestrator for UI Side-Effects (Sound, Toasts, etc.)
        const unsubscribe = realtimeOrchestrator.onEvent((event) => {
            const { type, payload, originClientId } = event;

            // 🏛️ Filter for User Domain Side-Effects
            if (type === 'notification' || type === 'presence-update') {
                // Origin check (redundant but safe since Orchestrator already does it for state)
                if (originClientId === myClientId) return;

                // 1. Notification Side-Effects
                if (type === 'notification' && payload.notification) {
                    const notif = payload.notification;
                    const isBadgeNotification = notif.type === 'badge';

                    // sound and tracking
                    const notified = JSON.parse(localStorage.getItem('safespot_seen_sse_ids') || '[]');
                    if (!notified.includes(notif.id) && !isBadgeNotification) {
                        import('./useBadgeNotifications').then(({ playBadgeSound }) => playBadgeSound());
                        notified.push(notif.id);
                        if (notified.length > 50) notified.shift();
                        localStorage.setItem('safespot_seen_sse_ids', JSON.stringify(notified));
                    }


                }

                // 2. Custom Callbacks
                if (onNotification) onNotification(payload);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [anonymousId, myClientId, onNotification]);
}
