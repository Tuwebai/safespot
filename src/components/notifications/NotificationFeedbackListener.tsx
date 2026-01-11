import { useNotificationFeedback } from '@/hooks/useNotificationFeedback';

/**
 * Headless component to listen for notifications and trigger feedback (toast/sound).
 * Must be placed inside ToastProvider.
 */
export function NotificationFeedbackListener() {
    useNotificationFeedback();
    return null;
}
