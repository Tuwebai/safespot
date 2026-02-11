/**
 * 🏛️ SAFE MODE: useUploadAvatarMutation - Enterprise Grade
 * 
 * Hook para subir avatar de usuario con:
 * - Validación de archivo (tamaño, formato)
 * - Optimistic cache update
 * - Toast notifications
 * - Error handling enterprise
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { handleError } from '@/lib/errorHandler';
import { queryKeys } from '@/lib/queryKeys';

export interface UploadAvatarOptions {
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}

/**
 * Validate avatar file before upload
 * Enterprise validation rules
 */
export function validateAvatarFile(file: File): { valid: boolean; error?: string } {
    // Size validation: 2MB max
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        return { valid: false, error: 'La imagen debe ser menor a 2MB' };
    }

    // Format validation
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
        return { valid: false, error: 'Formato no válido. Usa JPG, PNG o WebP' };
    }

    return { valid: true };
}

export function useUploadAvatarMutation(options?: UploadAvatarOptions) {
    const queryClient = useQueryClient();
    const toast = useToast();

    return useMutation({
        mutationFn: async (file: File) => {
            const validation = validateAvatarFile(file);
            if (!validation.valid) {
                throw new Error(validation.error);
            }
            return usersApi.uploadAvatar(file);
        },
        onSuccess: () => {
            // Invalidate profile cache to refetch with new avatar
            queryClient.invalidateQueries({ queryKey: queryKeys.user.profile });
            
            toast.success('Avatar actualizado correctamente');
            options?.onSuccess?.();
        },
        onError: (err) => {
            handleError(err, toast.error, 'useUploadAvatarMutation');
            options?.onError?.(err as Error);
        }
    });
}
