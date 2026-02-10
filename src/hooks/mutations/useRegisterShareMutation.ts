import { useMutation } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';

export function useRegisterShareMutation() {
    return useMutation({
        mutationFn: (reportId: string) => reportsApi.registerShare(reportId),
    });
}
