import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userZonesApi, type UserZoneData } from '../lib/api';

/**
 * Hook para gestionar "Tu Zona" (Backend-Driven)
 * SSOT: Backend calcula SafeScore y persiste ubicación
 */
export function useUserZone() {
    const queryClient = useQueryClient();

    // Query: Obtener zonas del usuario (si existen)
    const { data: zones, isLoading } = useQuery({
        queryKey: ['user-zones'],
        queryFn: () => userZonesApi.getAll(),
        staleTime: 5 * 60 * 1000, // 5 min
    });

    // Mutation: Actualizar zona actual (POST /user-zones/current)
    const updateCurrentZone = useMutation({
        mutationFn: ({ lat, lng, label }: { lat: number; lng: number; label?: string }) =>
            userZonesApi.updateCurrent(lat, lng, label),
        onSuccess: (data: UserZoneData) => {
            // Optimistic UI: Actualizar cache inmediatamente
            queryClient.setQueryData(['user-zones'], (old: any) => {
                if (!old) return [data.zone];
                const filtered = old.filter((z: any) => z.type !== 'current');
                return [data.zone, ...filtered];
            });

            // Invalidar queries relacionadas
            queryClient.invalidateQueries({ queryKey: ['user-zones'] });
        },
    });

    return {
        zones,
        isLoading,
        updateCurrentZone: updateCurrentZone.mutate,
        updateCurrentZoneAsync: updateCurrentZone.mutateAsync,
        isUpdating: updateCurrentZone.isPending,
        error: updateCurrentZone.error,
    };
}
