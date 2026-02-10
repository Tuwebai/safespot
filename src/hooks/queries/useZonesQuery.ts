import { useQuery } from '@tanstack/react-query';
import { seoApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { logError } from '@/lib/logger';

export function useZonesQuery() {
    return useQuery({
        queryKey: queryKeys.zones.all,
        queryFn: async () => {
            try {
                return await seoApi.getZones();
            } catch (err) {
                logError(err, 'useZonesQuery');
                throw err;
            }
        },
        staleTime: 5 * 60 * 1000, // 5 minutes - zones don't change often
        gcTime: 10 * 60 * 1000, // 10 minutes
    });
}
