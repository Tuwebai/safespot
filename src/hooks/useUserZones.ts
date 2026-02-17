import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { ZoneType, UserZone } from '@/lib/api';
import { getAnonymousIdSafe } from '@/lib/identity';
import { useToast } from '@/components/ui/toast';
import { useAuthGuard } from '@/hooks/useAuthGuard';


const EMPTY_ARRAY: UserZone[] = [];

export const useUserZones = () => {
    const anonymousId = getAnonymousIdSafe();
    const queryClient = useQueryClient();
    const { success, error } = useToast();
    const { checkAuth } = useAuthGuard(); // ✅ HOTFIX: Auth Guard
    const queryKey = ['user-zones', anonymousId];

    const { data: zones = EMPTY_ARRAY, isLoading } = useQuery<UserZone[]>({
        queryKey,
        queryFn: async () => {
            if (!anonymousId) return [];
            // apiRequest already unwraps 'data' property and validates contract
            const response = await apiRequest<UserZone[]>('/user-zones');
            return response;
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
            // ✅ AUTH GUARD: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return apiRequest<{ data: UserZone }>('/user-zones', {
                method: 'POST',
                body: JSON.stringify(zone)
            });
        },
        onMutate: async (newZone) => {
            // 1. Cancel any outgoing refetches to prevent overwrite
            await queryClient.cancelQueries({ queryKey });

            // 2. Snapshot the previous value
            const previousZones = queryClient.getQueryData<UserZone[]>(queryKey);

            // 3. Optimistically update to the new value
            if (previousZones) {
                queryClient.setQueryData<UserZone[]>(queryKey, (old) => {
                    const existingIndex = old?.findIndex(z => z.type === newZone.type);
                    const optimisticZone = {
                        ...newZone,
                        id: newZone.id || `temp-${Date.now()}`,
                        created_at: new Date().toISOString()
                    } as UserZone;

                    if (existingIndex !== undefined && existingIndex !== -1 && old) {
                        // Update existing
                        const newZones = [...old];
                        newZones[existingIndex] = { ...newZones[existingIndex], ...optimisticZone };
                        return newZones;
                    } else {
                        // Add new
                        return [...(old || []), optimisticZone];
                    }
                });
            }

            return { previousZones };
        },
        onError: (_err, _newZone, context) => {
            // 4. Rollback to the previous value
            if (context?.previousZones) {
                queryClient.setQueryData(queryKey, context.previousZones);
            }
            // Don't show generic error if it is auth required (handled by modal)
            if (_err.message !== 'AUTH_REQUIRED') {
                error('Error al guardar la zona');
            }
        },
        onSettled: () => {
            // 5. Always refetch to sync with server
            queryClient.invalidateQueries({ queryKey });
        },
        onSuccess: () => {
            success('Zona guardada correctamente');
        },
    });

    const deleteZone = useMutation({
        mutationFn: async (type: ZoneType) => {
            // ✅ AUTH GUARD: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return apiRequest(`/user-zones/${type}`, {
                method: 'DELETE'
            });
        },
        onMutate: async (type) => {
            await queryClient.cancelQueries({ queryKey });
            const previousZones = queryClient.getQueryData<UserZone[]>(queryKey);

            queryClient.setQueryData<UserZone[]>(queryKey, (old) => {
                return old?.filter(z => z.type !== type) || [];
            });

            return { previousZones };
        },
        onError: (_err, _type, context) => {
            if (context?.previousZones) {
                queryClient.setQueryData(queryKey, context.previousZones);
            }
            error('Error al eliminar la zona');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey });
        },
        onSuccess: () => {
            success('Zona eliminada');
        },
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
