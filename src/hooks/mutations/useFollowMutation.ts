import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { logError } from '@/lib/logger';

interface FollowVariables {
    anonymousId: string;
    action: 'follow' | 'unfollow';
}

export function useFollowMutation() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, FollowVariables>({
        mutationFn: async ({ anonymousId, action }) => {
            if (action === 'follow') {
                await usersApi.follow(anonymousId);
            } else {
                await usersApi.unfollow(anonymousId);
            }
        },
        onSuccess: () => {
            // Invalidate all user-related queries
            void queryClient.invalidateQueries({ queryKey: ['user'] });
            void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
        onError: (err) => {
            logError(err, 'useFollowMutation');
        },
    });
}
