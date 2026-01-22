import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { useAnonymousId } from '@/hooks/useAnonymousId';

export const SETTINGS_QUERY_KEY = ['settings', 'user'];

export function useSettingsQuery() {
    const anonymousId = useAnonymousId();

    return useQuery({
        queryKey: SETTINGS_QUERY_KEY,
        queryFn: () => notificationsApi.getSettings(),
        enabled: !!anonymousId,
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: false
    });
}
