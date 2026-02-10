import { useMutation } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';
import { logError } from '@/lib/logger';

interface UploadVariables {
    reportId: string;
    files: File[];
}

export function useUploadReportImagesMutation() {
    return useMutation<void, Error, UploadVariables>({
        mutationFn: async ({ reportId, files }) => {
            await reportsApi.uploadImages(reportId, files);
        },
        onError: (err) => {
            logError(err, 'useUploadReportImagesMutation');
        },
    });
}
