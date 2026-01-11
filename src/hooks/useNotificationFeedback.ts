import { useEffect, useRef } from 'react';
import { useNotificationsQuery } from '@/hooks/queries/useNotificationsQuery';
import { useToast } from '@/components/ui/toast/useToast';
import { playNotificationSound } from '@/lib/audio';

export function useNotificationFeedback() {
    const { data: notifications } = useNotificationsQuery();
    const { info } = useToast();

    // Track the ID of the latest notification we have seen
    const lastLatestIdRef = useRef<string | null>(null);
    const isFirstRun = useRef(true);

    useEffect(() => {
        if (!notifications || notifications.length === 0) return;

        // Assuming API returns sorted DESC (newest first)
        const latest = notifications[0];

        if (isFirstRun.current) {
            // On first mount, just store the latest ID, don't notify
            lastLatestIdRef.current = latest.id;
            isFirstRun.current = false;
            return;
        }

        // If we have a new latest ID, it means a new notification arrived
        if (lastLatestIdRef.current !== latest.id) {
            // Trigger feedback
            playNotificationSound();

            const title = latest.title || 'Nueva notificación';
            // Combine title and message since our toast only accepts a string message
            info(`${title}: ${latest.message}`, 5000);

            // Update ref
            lastLatestIdRef.current = latest.id;
        }
    }, [notifications, info]);
}
