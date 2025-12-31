import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, Notification } from '@/lib/api';

export const NOTIFICATIONS_QUERY_KEY = ['notifications', 'list'];

export function useNotificationsQuery() {
    return useQuery({
        queryKey: NOTIFICATIONS_QUERY_KEY,
        queryFn: () => notificationsApi.getAll(),
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
        mutationFn: (id: string) => notificationsApi.markAsRead(id),
        onSuccess: (_, id) => {
            // Optimistically update cache
            queryClient.setQueryData<Notification[]>(NOTIFICATIONS_QUERY_KEY, (old) =>
                old?.map(n => n.id === id ? { ...n, is_read: true } : n) || []
            );
        }
    });
}

export function useMarkAllNotificationsReadMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => notificationsApi.markAllAsRead(),
        onSuccess: () => {
            // Optimistically update cache
            queryClient.setQueryData<Notification[]>(NOTIFICATIONS_QUERY_KEY, (old) =>
                old?.map(n => ({ ...n, is_read: true })) || []
            );
        }
    });
}
