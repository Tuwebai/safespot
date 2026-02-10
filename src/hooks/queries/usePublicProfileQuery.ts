import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { logError } from '@/lib/logger';
import type { PublicUserProfile } from '@/types/user';

export function usePublicProfileQuery(alias: string | undefined) {
    return useQuery<PublicUserProfile, Error>({
        queryKey: queryKeys.user.publicProfile(alias || ''),
        queryFn: async () => {
            if (!alias) throw new Error('Alias is required');
            try {
                const cleanAlias = alias.replace(/^@/, '');
                return await usersApi.getPublicProfile(cleanAlias) as unknown as PublicUserProfile;
            } catch (err) {
                logError(err, 'usePublicProfileQuery');
                throw err;
            }
        },
        enabled: !!alias,
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes
    });
}
