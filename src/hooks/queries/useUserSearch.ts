/**
 * 🏛️ SAFE MODE: useUserSearch Hook
 * 
 * Hook para buscar usuarios por término de búsqueda.
 * Encapsula la llamada a usersApi.search para cumplir con la regla
 * de no importar API directamente en componentes UI.
 * 
 * @version 1.0 - Enterprise Pattern
 */

import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import type { UserProfile } from '@/lib/api';

interface UseUserSearchOptions {
    enabled?: boolean;
}

export function useUserSearch(query: string, options: UseUserSearchOptions = {}) {
    const { enabled = true } = options;

    return useQuery<UserProfile[]>({
        queryKey: ['users', 'search', query],
        queryFn: async () => {
            if (!query.trim() || query.length < 2) {
                return [];
            }
            const results = await usersApi.search(query);
            return results;
        },
        enabled: enabled && query.trim().length >= 2,
        staleTime: 1000 * 30, // 30 seconds
        gcTime: 1000 * 60 * 5, // 5 minutes
    });
}
