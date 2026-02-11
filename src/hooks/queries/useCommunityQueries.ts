/**
 * 🏛️ SAFE MODE: useCommunityQueries Hooks
 * 
 * Hooks para obtener usuarios de la comunidad (nearby y global).
 * Encapsulan las llamadas a usersApi para cumplir con la regla
 * de no importar API directamente en componentes UI.
 * 
 * @version 1.0 - Enterprise Pattern
 */

import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import type { UserProfile } from '@/lib/api';

// ============================================
// TYPES
// ============================================

interface NearbyUsersMeta {
    locality?: string;
    has_location_configured?: boolean;
}

interface NearbyUsersResponse {
    users: UserProfile[];
    meta: NearbyUsersMeta;
}

interface UseNearbyUsersOptions {
    enabled?: boolean;
    onSuccess?: (data: NearbyUsersResponse) => void;
}

interface UseGlobalUsersOptions {
    enabled?: boolean;
    limit?: number;
}

// ============================================
// NORMALIZATION
// ============================================

function normalizeUsers(data: unknown): UserProfile[] {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
        const d = data as Record<string, unknown>;
        if (Array.isArray(d.data)) return d.data as UserProfile[];
        if (Array.isArray(d.users)) return d.users as UserProfile[];
    }
    return [];
}

function extractMeta(response: unknown): NearbyUsersMeta {
    if (response && typeof response === 'object') {
        const r = response as Record<string, unknown>;
        return (r.meta as NearbyUsersMeta) || {};
    }
    return {};
}

// ============================================
// QUERIES
// ============================================

export function useNearbyUsersQuery(options: UseNearbyUsersOptions = {}) {
    const { enabled = true, onSuccess } = options;

    return useQuery<NearbyUsersResponse>({
        queryKey: ['users', 'nearby'],
        queryFn: async () => {
            const response = await usersApi.getNearbyUsers();
            const users = normalizeUsers(response);
            const meta = extractMeta(response);
            
            const result = { users, meta };
            onSuccess?.(result);
            return result;
        },
        enabled,
        staleTime: 1000 * 10,     // 10 seconds
        refetchInterval: 1000 * 30, // 30 seconds
    });
}

export function useGlobalUsersQuery(options: UseGlobalUsersOptions = {}) {
    const { enabled = true, limit = 200 } = options;

    return useQuery<UserProfile[]>({
        queryKey: ['users', 'global', { limit }],
        queryFn: async () => {
            const response = await usersApi.getGlobalUsers(1, limit);
            return normalizeUsers(response);
        },
        enabled,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
