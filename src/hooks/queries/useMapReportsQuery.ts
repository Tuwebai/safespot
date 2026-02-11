/**
 * 🏛️ SAFE MODE: useMapReportsQuery Hook
 * 
 * Hook para obtener reportes en el mapa (bounds o todos).
 * Encapsula las llamadas a reportsApi para cumplir con la regla
 * de no importar API directamente en componentes UI.
 * 
 * @version 1.0 - Enterprise Pattern
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';
import type { Report } from '@/lib/schemas';
import { reportsCache } from '@/lib/cache-helpers';

interface Bounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

interface UseMapReportsOptions {
    bounds: Bounds | null;
    searchBoundsKey: string | null; // stable key for queryKey
    enabled?: boolean;
}

export function useMapReportsQuery(options: UseMapReportsOptions) {
    const { bounds, searchBoundsKey, enabled = true } = options;
    const queryClient = useQueryClient();

    return useQuery<string[]>({
        queryKey: ['reports', 'list', searchBoundsKey || 'all'],
        queryFn: async () => {
            let data: Report[];
            if (bounds) {
                const { north, south, east, west } = bounds;
                data = await reportsApi.getReportsInBounds(north, south, east, west);
            } else {
                data = await reportsApi.getAll();
            }
            // ENTERPRISE: Normalize into cache, return IDs
            return reportsCache.store(queryClient, data);
        },
        enabled,
        staleTime: 60000, // 60 seconds
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
}
