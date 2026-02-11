/**
 * 🏛️ SAFE MODE: useRealtimeStatusQuery Hook
 * 
 * Hook para consultar el estado de infraestructura realtime.
 * Encapsula la llamada a /realtime/status para cumplir con la regla
 * de no importar API directamente en componentes UI.
 * 
 * @version 1.0 - Enterprise Pattern
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export interface RealtimeStatus {
    success: boolean;
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    infrastructure: {
        redis: string;
        redis_subscriber: string;
        database: string;
        db_latency_ms: number;
        instance_id: string;
    };
    metrics: {
        total_online: number;
    };
}

interface UseRealtimeStatusOptions {
    refetchInterval?: number;
    enabled?: boolean;
}

export function useRealtimeStatusQuery(options: UseRealtimeStatusOptions = {}) {
    const { refetchInterval = 10000, enabled = true } = options;

    return useQuery<RealtimeStatus>({
        queryKey: ['realtime', 'status'],
        queryFn: () => apiRequest('/realtime/status'),
        refetchInterval,
        retry: 3,
        enabled,
    });
}
