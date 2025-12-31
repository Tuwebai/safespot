import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, ZoneType, UserZone } from '@/lib/api';
import { getAnonymousIdSafe } from '@/lib/identity';
import { useToast } from '@/components/ui/toast';

export const useUserZones = () => {
    const anonymousId = getAnonymousIdSafe();
    const queryClient = useQueryClient();
    const { success, error } = useToast();
    const queryKey = ['user-zones', anonymousId];

    const { data: zones = [], isLoading } = useQuery<UserZone[]>({
        queryKey,
        queryFn: async () => {
            if (!anonymousId) return [];
            try {
                // apiRequest already unwraps 'data' property
                const response = await apiRequest<UserZone[]>('/user-zones');
                return response || [];
            } catch (err) {
                console.error('[useUserZones] Fetch failed:', err);
                return []; // Always return array for safety
            }
        },
        enabled: !!anonymousId,
        staleTime: 5 * 60 * 1000, // 5 minutes fresh
        gcTime: 30 * 60 * 1000,  // Keep in cache for 30 minutes
        retry: (failureCount, error: any) => {
            // Never retry for 429s or 404s
            if (error?.status === 429 || error?.status === 404) return false;
            return failureCount < 1; // Strict: max 1 retry for other errors
        },
        refetchOnWindowFocus: false, // Prevent spam on tab switch
    });

    const saveZone = useMutation({
        mutationFn: async (zone: Partial<UserZone>) => {
            return apiRequest<{ data: UserZone }>('/user-zones', {
                method: 'POST',
                body: JSON.stringify(zone)
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            success('Zona guardada correctamente');
        },
        onError: () => {
            error('Error al guardar la zona');
        }
    });

    const deleteZone = useMutation({
        mutationFn: async (type: ZoneType) => {
            return apiRequest(`/user-zones/${type}`, {
                method: 'DELETE'
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            success('Zona eliminada');
        },
        onError: () => {
            error('Error al eliminar la zona');
        }
    });

    return {
        zones,
        isLoading,
        saveZone: saveZone.mutateAsync,
        isSaving: saveZone.isPending,
        deleteZone: deleteZone.mutateAsync,
        isDeleting: deleteZone.isPending
    };
};
