import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useTransparencyLogQuery() {
    return useQuery({
        queryKey: queryKeys.user.transparencyLog,
        queryFn: () => usersApi.getTransparencyLog(),
        staleTime: 5 * 60 * 1000, // 5 minutos
        retry: 2,
    });
}
