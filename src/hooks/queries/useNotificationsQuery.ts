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
    const anonymousId = useAnonymousId();

    return useMutation({
        mutationFn: (id: string) => notificationsApi.markRead(id),
        onMutate: async (id) => {
            const queryKey = ['notifications', 'list', anonymousId];
            await queryClient.cancelQueries({ queryKey });
            const previousNotifications = queryClient.getQueryData<Notification[]>(queryKey);

            queryClient.setQueryData<Notification[]>(queryKey, (old) =>
                old?.map(n => n.id === id ? { ...n, is_read: true } : n) || []
            );

            return { previousNotifications, queryKey };
        },
        onError: (_err, _id, context) => {
            if (context?.previousNotifications && context.queryKey) {
                queryClient.setQueryData(context.queryKey, context.previousNotifications);
            }
        },
        // ✅ ENTERPRISE FIX: No onSettled invalidation
        // Optimistic update is already correct, server confirmation reconciles silently
    });
}

export function useMarkAllNotificationsReadMutation() {
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();

    return useMutation({
        mutationFn: () => notificationsApi.markAllRead(),
        onMutate: async () => {
            const queryKey = ['notifications', 'list', anonymousId];
            await queryClient.cancelQueries({ queryKey });
            const previousNotifications = queryClient.getQueryData<Notification[]>(queryKey);

            queryClient.setQueryData<Notification[]>(queryKey, (old) =>
                old?.map(n => ({ ...n, is_read: true })) || []
            );

            return { previousNotifications, queryKey };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousNotifications && context.queryKey) {
                queryClient.setQueryData(context.queryKey, context.previousNotifications);
            }
        },
        // ✅ ENTERPRISE FIX: No onSettled invalidation
        // Optimistic update is already correct, server confirmation reconciles silently
    });
}

export function useDeleteAllNotificationsMutation() {
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();

    return useMutation({
        mutationFn: () => notificationsApi.deleteAll(),
        onMutate: async () => {
            const queryKey = ['notifications', 'list', anonymousId];
            await queryClient.cancelQueries({ queryKey });
            const previousNotifications = queryClient.getQueryData<Notification[]>(queryKey);

            queryClient.setQueryData<Notification[]>(queryKey, []);

            return { previousNotifications, queryKey };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousNotifications && context.queryKey) {
                queryClient.setQueryData(context.queryKey, context.previousNotifications);
            }
        }
    });
}
