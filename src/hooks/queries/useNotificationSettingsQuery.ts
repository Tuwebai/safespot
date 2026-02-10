import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { logError } from '@/lib/logger';

export function useNotificationSettingsQuery() {
    return useQuery({
        queryKey: queryKeys.notifications.settings,
        queryFn: async () => {
            try {
                return await notificationsApi.getSettings();
            } catch (err) {
                logError(err, 'useNotificationSettingsQuery');
                throw err;
            }
        },
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 5 * 60 * 1000, // 5 minutes
    });
}
