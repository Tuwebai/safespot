import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { logError } from '@/lib/logger';
import type { UserListItem } from '@/types/user';

export function useFollowersQuery(alias: string | undefined) {
    return useQuery<UserListItem[], Error>({
        queryKey: queryKeys.user.followers(alias || ''),
        queryFn: async () => {
            if (!alias) throw new Error('Alias is required');
            try {
                const cleanAlias = alias.replace(/^@/, '');
                return await usersApi.getFollowers(cleanAlias) as UserListItem[];
            } catch (err) {
                logError(err, 'useFollowersQuery');
                throw err;
            }
        },
        enabled: !!alias,
        staleTime: 30 * 1000,
    });
}
