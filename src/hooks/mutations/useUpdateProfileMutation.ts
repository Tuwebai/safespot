import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { handleError } from '@/lib/errorHandler';

export function useUpdateProfileMutation() {
    const queryClient = useQueryClient();
    const toast = useToast();

    return useMutation({
        mutationFn: (data: Parameters<typeof usersApi.updateProfile>[0]) =>
            usersApi.updateProfile(data),
        onSuccess: () => {
            // Invalida la caché del perfil para forzar una recarga
            queryClient.invalidateQueries({ queryKey: ['profile'] });
        },
        onError: (err) => {
            handleError(err, toast.error, 'useUpdateProfileMutation');
        }
    });
}
