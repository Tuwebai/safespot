import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, Notification } from '@/lib/api';
import { useAnonymousId } from '@/hooks/useAnonymousId';
// ✅ PHASE 2: Auth Guard for Mutations
import { useAuthGuard } from '@/hooks/useAuthGuard';

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
        // 🔴 SECURITY FIX: placeholderData REMOVED
        // Reason: Auth-dependent query. placeholderData would hide 401 errors
        // and show stale data when token expires, creating misleading UX.
        // User must see loading state on auth errors to trigger proper error handling.
    });
}

export function useMarkNotificationReadMutation() {
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();
    const { checkAuth } = useAuthGuard(); // ✅ PHASE 2: Auth guard

    return useMutation({
        mutationFn: async (id: string) => {
            // ✅ AUTH GUARD: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return notificationsApi.markRead(id);
        },
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
    const { checkAuth } = useAuthGuard(); // ✅ PHASE 2: Auth guard

    return useMutation({
        mutationFn: async () => {
            // ✅ AUTH GUARD: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return notificationsApi.markAllRead();
        },
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
    const { checkAuth } = useAuthGuard(); // ✅ PHASE 2: Auth guard

    return useMutation({
        mutationFn: async () => {
            // ✅ AUTH GUARD: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return notificationsApi.deleteAll();
        },
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

export function useDeleteNotificationMutation() {
    const { checkAuth } = useAuthGuard();

    return useMutation({
        mutationFn: async (id: string) => {
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return notificationsApi.delete(id);
        }
    });
}
