import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useToggleReportLikeMutation } from '@/hooks/queries/useReportsQuery';
import { reportsCache } from '@/lib/cache-helpers';
import { queryKeys } from '@/lib/queryKeys';
import { reportsApi } from '@/lib/api';

vi.mock('@/lib/api', () => ({
    reportsApi: {
        toggleLike: vi.fn(),
    },
}));

vi.mock('@/hooks/useAnalytics', () => ({
    useAnalytics: () => ({
        trackEvent: vi.fn().mockResolvedValue(undefined),
    }),
}));

describe('Report like consistency - parallel updates', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        });
        vi.clearAllMocks();
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    it('like no hace flicker cuando llega patch paralelo sin is_liked', async () => {
        const reportId = 'r-like-1';
        queryClient.setQueryData(queryKeys.reports.detail(reportId), {
            id: reportId,
            title: 'Reporte test',
            is_liked: false,
            upvotes_count: 7,
        });

        let resolveMutation: ((value: { is_liked: boolean; upvotes_count: number }) => void) | null = null;
        vi.mocked(reportsApi.toggleLike).mockReturnValue(
            new Promise((resolve) => {
                resolveMutation = resolve;
            }) as Promise<{ is_liked: boolean; upvotes_count: number }>
        );

        const { result } = renderHook(() => useToggleReportLikeMutation(), { wrapper });

        act(() => {
            result.current.mutate({ reportId, liked: true });
        });

        await waitFor(() => {
            const afterOptimistic = queryClient.getQueryData<{ is_liked: boolean; upvotes_count: number }>(
                queryKeys.reports.detail(reportId)
            );
            expect(afterOptimistic?.is_liked).toBe(true);
        });

        act(() => {
            reportsCache.patch(queryClient, reportId, { upvotes_count: 8 });
        });

        const afterParallelPatch = queryClient.getQueryData<{ is_liked: boolean; upvotes_count: number }>(
            queryKeys.reports.detail(reportId)
        );
        expect(afterParallelPatch?.is_liked).toBe(true);
        expect(afterParallelPatch?.upvotes_count).toBe(8);

        act(() => {
            resolveMutation?.({ is_liked: true, upvotes_count: 8 });
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        const finalState = queryClient.getQueryData<{ is_liked: boolean; upvotes_count: number }>(
            queryKeys.reports.detail(reportId)
        );
        expect(finalState?.is_liked).toBe(true);
        expect(finalState?.upvotes_count).toBe(8);
    });
});
