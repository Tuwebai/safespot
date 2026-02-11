/**
 * 🏛️ SAFE MODE: useDeleteAvatarMutation - Enterprise Grade
 * 
 * Hook para eliminar avatar de usuario con:
 * - Confirmación implícita (llamado desde UI de confirmación)
 * - Cache invalidation
 * - Error handling enterprise
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { handleError } from '@/lib/errorHandler';
import { queryKeys } from '@/lib/queryKeys';

export interface DeleteAvatarOptions {
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}

export function useDeleteAvatarMutation(options?: DeleteAvatarOptions) {
    const queryClient = useQueryClient();
    const toast = useToast();

    return useMutation({
        mutationFn: async () => {
            // Note: Backend endpoint for delete may need verification
            // Using updateProfile with null as fallback if no specific delete endpoint
            return usersApi.updateProfile({ avatar_url: null });
        },
        onSuccess: () => {
            // Invalidate profile cache
            queryClient.invalidateQueries({ queryKey: queryKeys.user.profile });
            
            toast.success('Avatar eliminado correctamente');
            options?.onSuccess?.();
        },
        onError: (err) => {
            handleError(err, toast.error, 'useDeleteAvatarMutation');
            options?.onError?.(err as Error);
        }
    });
}
