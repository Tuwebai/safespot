import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { logError } from '@/lib/logger';
import type { UserListItem } from '@/types/user';

export function useFollowingQuery(alias: string | undefined) {
    return useQuery<UserListItem[], Error>({
        queryKey: queryKeys.user.following(alias || ''),
        queryFn: async () => {
            if (!alias) throw new Error('Alias is required');
            try {
                const cleanAlias = alias.replace(/^@/, '');
                return await usersApi.getFollowing(cleanAlias) as UserListItem[];
            } catch (err) {
                logError(err, 'useFollowingQuery');
                throw err;
            }
        },
        enabled: !!alias,
        staleTime: 30 * 1000,
    });
}
