/**
 * 🏛️ SAFE MODE: Personal Alias Mutation Hook
 * 
 * Hook para gestionar alias personales de usuarios.
 * Los aliases son privados y solo visibles para el owner.
 * 
 * @version 1.0 - Enterprise
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

interface UsePersonalAliasMutationResult {
    setAlias: (targetId: string, alias: string) => void;
    removeAlias: (targetId: string) => void;
    isPending: boolean;
}

/**
 * Hook para crear/actualizar/eliminar alias personales
 * 
 * Invalida automáticamente las queries de usuarios para reflejar cambios
 */
export function usePersonalAliasMutation(): UsePersonalAliasMutationResult {
    const queryClient = useQueryClient();
    const { success, error } = useToast();

    const setMutation = useMutation({
        mutationFn: ({ targetId, alias }: { targetId: string; alias: string }) =>
            usersApi.setPersonalAlias(targetId, alias),
        onSuccess: (result) => {
            // Invalidar caches de usuarios
            queryClient.invalidateQueries({ queryKey: ['users', 'nearby'] });
            queryClient.invalidateQueries({ queryKey: ['users', 'global'] });
            
            success(`Alias guardado: #${result.alias}`);
        },
        onError: (err: Error) => {
            error(err.message || 'No se pudo guardar el alias');
        },
    });

    const removeMutation = useMutation({
        mutationFn: (targetId: string) => usersApi.removePersonalAlias(targetId),
        onSuccess: () => {
            // Invalidar caches de usuarios
            queryClient.invalidateQueries({ queryKey: ['users', 'nearby'] });
            queryClient.invalidateQueries({ queryKey: ['users', 'global'] });
            
            success('Alias eliminado');
        },
        onError: (err: Error) => {
            error(err.message || 'No se pudo eliminar el alias');
        },
    });

    return {
        setAlias: (targetId: string, alias: string) => 
            setMutation.mutate({ targetId, alias }),
        removeAlias: (targetId: string) => 
            removeMutation.mutate(targetId),
        isPending: setMutation.isPending || removeMutation.isPending,
    };
}
