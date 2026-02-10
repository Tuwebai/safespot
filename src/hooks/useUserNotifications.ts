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
                // Origin check
                if (originClientId === myClientId) return;

                // SSOT: Standardize access to partial data
                // 🏛️ SAFE MODE: Type assertion para compatibilidad durante migración
                const payloadObj = payload as Record<string, unknown>;
                const actualPayload = (payloadObj.partial as Record<string, unknown>) || payloadObj;

                // 1. Notification Side-Effects
                if (type === 'notification' && actualPayload.notification) {
                    const notif = actualPayload.notification as Record<string, unknown>;
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
                if (onNotification) onNotification(actualPayload as unknown as { type: string; [key: string]: unknown });
            }
        });

        return () => {
            unsubscribe();
        };
    }, [anonymousId, myClientId, onNotification]);
}
