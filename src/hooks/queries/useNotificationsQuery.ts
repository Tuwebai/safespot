import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, Notification } from '@/lib/api';
import { useAnonymousId } from '@/hooks/useAnonymousId';

export const NOTIFICATIONS_QUERY_KEY = ['notifications', 'list'];

export function useNotificationsQuery() {
    const anonymousId = useAnonymousId();  // ✅ SSOT

    return useQuery({
        queryKey: ['notifications', 'list', anonymousId],  // ✅ Include ID
        queryFn: () => notificationsApi.getAll(),
        enabled: !!anonymousId,  // ✅ CRITICAL: Never execute with null ID
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes
        retry: false, // Fail fast on 429s/errors
        refetchOnWindowFocus: false, // Prevent spam on tab switch
        refetchOnReconnect: false, // Prevent spam on network reconnect
        refetchInterval: 5 * 60 * 1000, // Poll every 5 minutes (very conservative)
    });
}

export function useMarkNotificationReadMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => notificationsApi.markRead(id),
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
            const previousNotifications = queryClient.getQueryData<Notification[]>(NOTIFICATIONS_QUERY_KEY);

            queryClient.setQueryData<Notification[]>(NOTIFICATIONS_QUERY_KEY, (old) =>
                old?.map(n => n.id === id ? { ...n, is_read: true } : n) || []
            );

            return { previousNotifications };
        },
        onError: (_err, _id, context) => {
            if (context?.previousNotifications) {
                queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previousNotifications);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
        }
    });
}

export function useMarkAllNotificationsReadMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => notificationsApi.markAllRead(),
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
            const previousNotifications = queryClient.getQueryData<Notification[]>(NOTIFICATIONS_QUERY_KEY);

            queryClient.setQueryData<Notification[]>(NOTIFICATIONS_QUERY_KEY, (old) =>
                old?.map(n => ({ ...n, is_read: true })) || []
            );

            return { previousNotifications };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousNotifications) {
                queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previousNotifications);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
        }
    });
}
