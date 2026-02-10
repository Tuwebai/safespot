import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { logError } from '@/lib/logger';
import type { UserListItem } from '@/types/user';

export function useSuggestionsQuery(enabled: boolean = true) {
    return useQuery<UserListItem[], Error>({
        queryKey: queryKeys.user.suggestions,
        queryFn: async () => {
            try {
                const suggestions = await usersApi.getSuggestions();
                // Map suggestions to have is_following: false by definition
                return suggestions.map((s: unknown) => ({
                    ...(s as UserListItem),
                    is_following: false
                }));
            } catch (err) {
                logError(err, 'useSuggestionsQuery');
                throw err;
            }
        },
        enabled,
        staleTime: 60 * 1000,
    });
}
