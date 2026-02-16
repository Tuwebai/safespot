import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { reportsCache } from './cache-helpers';
import { queryKeys } from './queryKeys';

describe('reportsCache.patch - like state preservation', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });
    });

    it('preserva is_liked cuando el patch parcial no lo incluye', () => {
        const reportId = 'r1';
        queryClient.setQueryData(queryKeys.reports.detail(reportId), {
            id: reportId,
            title: 'Reporte',
            is_liked: true,
            upvotes_count: 10,
        });

        reportsCache.patch(queryClient, reportId, { upvotes_count: 11 });

        const updated = queryClient.getQueryData<{ is_liked: boolean; upvotes_count: number }>(
            queryKeys.reports.detail(reportId)
        );

        expect(updated?.upvotes_count).toBe(11);
        expect(updated?.is_liked).toBe(true);
    });
});

