import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, type NotificationSettings } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { logError } from '@/lib/logger';

export function useUpdateNotificationSettingsMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (updates: Partial<NotificationSettings>) => {
            return await notificationsApi.updateSettings(updates);
        },
        onSuccess: () => {
            // Invalidate to ensure we have fresh data
            void queryClient.invalidateQueries({ 
                queryKey: queryKeys.notifications.settings 
            });
        },
        onError: (err) => {
            logError(err, 'useUpdateNotificationSettingsMutation');
        },
    });
}
