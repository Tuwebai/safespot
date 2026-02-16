import { useEffect, useRef } from 'react';
import { useNotificationsQuery } from '@/hooks/queries/useNotificationsQuery';
import { useToast } from '@/components/ui/toast';
import { playNotificationSound } from '@/lib/sound';

export function useNotificationFeedback() {
    const { data: notifications } = useNotificationsQuery();
    const { info } = useToast();

    const lastLatestIdRef = useRef<string | null>(null);
    const lastCountRef = useRef<number>(0);
    const isFirstRun = useRef(true);

    useEffect(() => {
        if (!notifications || notifications.length === 0) return;

        const latest = notifications[0];

        if (isFirstRun.current) {
            lastLatestIdRef.current = latest.id;
            lastCountRef.current = notifications.length;
            isFirstRun.current = false;
            return;
        }

        // Only notify on real arrivals (count grows). This prevents
        // false positives when deleting a notification changes list head.
        const hasRealArrival = notifications.length > lastCountRef.current;
        if (hasRealArrival && lastLatestIdRef.current !== latest.id) {
            playNotificationSound();
            const title = latest.title || 'Nueva notificacion';
            info(`${title}: ${latest.message}`, 5000);
        }

        lastLatestIdRef.current = latest.id;
        lastCountRef.current = notifications.length;
    }, [notifications, info]);
}
