import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupQueryContracts } from '@/lib/queryClient'
import {
    useCreateCommentMutation,
    useDeleteCommentMutation
} from '@/hooks/queries/useCommentsQuery'
import { commentsApi } from '@/lib/api'
import { commentsCache, reportsCache } from '@/lib/cache-helpers'
import { queryKeys } from '@/lib/queryKeys'
import React from 'react'
import { vi, describe, beforeEach, expect, test } from 'vitest'

// Mock de API
vi.mock('@/lib/api', () => ({
    commentsApi: {
        getById: vi.fn(),
        getByReportId: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        like: vi.fn(),
        unlike: vi.fn(),
        pin: vi.fn(),
        unpin: vi.fn(),
        flag: vi.fn()
    },
    trafficController: {
        enqueueSerial: vi.fn((fn) => fn())
    }
}))

// Mock de Auth/Identity
vi.mock('@/hooks/useAuthGuard', () => ({
    useAuthGuard: () => ({ checkAuth: () => true })
}))
vi.mock('@/hooks/useAnonymousId', () => ({
    useAnonymousId: () => 'test-user-123'
}))
vi.mock('@/lib/clientId', () => ({
    getClientId: () => 'my-client-id'
}))

describe('Comments Full Integration (CMT-ROOT-001)', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } }
        })
        setupQueryContracts(queryClient)
        vi.clearAllMocks()

        // Setup initial report in cache
        reportsCache.store(queryClient, [{
            id: 'r1',
            comments_count: 10,
            anonymous_id: 'other',
            title: 'Test',
            description: 'Test',
            category: 'Celulares',
            zone: 'Test',
            address: 'Test',
            latitude: 0,
            longitude: 0,
            status: 'abierto',
            upvotes_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        } as any])

        // Setup initial empty list for comments
        queryClient.setQueryData(queryKeys.comments.byReport('r1'), []);
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    test('Cláusula 1: Optimistic Cancel - Should cancel creation and skip backend if deleted while optimistic', async () => {
        // 1. Iniciar creación (pero dejamos la promesa "colgada" para simular lag)
        let resolveCreate: any;
        const createPromise = new Promise(resolve => { resolveCreate = resolve });
        vi.mocked(commentsApi.create).mockReturnValue(createPromise as any);

        const { result: createMut } = renderHook(() => useCreateCommentMutation(), { wrapper });
        const optimisticId = 'opt-123';

        await act(async () => {
            createMut.current.mutate({
                report_id: 'r1',
                content: 'Delayed comment',
                id: optimisticId
            });
        });

        // Verificar que existe en el caché y el contador subió (0ms)
        const reportAfterCreate = queryClient.getQueryData<any>(queryKeys.reports.detail('r1'));
        expect(reportAfterCreate.comments_count).toBe(11);
        expect(queryClient.getQueryData(queryKeys.comments.detail(optimisticId))).toBeTruthy();

        // 2. Intentar borrar el comentario OPTIMISTA antes de que regrese el POST
        const { result: deleteMut } = renderHook(() => useDeleteCommentMutation(), { wrapper });

        await act(async () => {
            deleteMut.current.mutate({ id: optimisticId, reportId: 'r1' });
        });

        // VERIFICACION: No debería haberse llamado al backend de DELETE
        expect(commentsApi.delete).not.toHaveBeenCalled();

        // VERIFICACION: El contador debería haber bajado a 10 inmediatamente
        const reportAfterDelete = queryClient.getQueryData<any>(queryKeys.reports.detail('r1'));
        expect(reportAfterDelete.comments_count).toBe(10);

        // VERIFICACION: El ID del comentario ya no debería estar en la lista
        const listAfterDelete = queryClient.getQueryData<string[]>(queryKeys.comments.byReport('r1'));
        expect(listAfterDelete).not.toContain(optimisticId);

        // 3. Resolver el POST (el lag termina)
        await act(async () => {
            resolveCreate({ id: optimisticId, content: 'Delayed comment', report_id: 'r1' });
        });

        // VERIFICACION FINAL: El comentario NO debe re-aparecer en la lista
        const listFinal = queryClient.getQueryData<string[]>(queryKeys.comments.byReport('r1'));
        expect(listFinal).not.toContain(optimisticId);
    });

    test('Cláusula 2: At-most-once Counter - SSE append should not double increment if item is already in list (Echo Suppression)', async () => {
        const comment = { id: 'c1', report_id: 'r1', content: 'Test' };

        // 1. Iniciamos con 1 item ya en la lista
        act(() => {
            commentsCache.prepend(queryClient, comment as any);
        });

        const report = queryClient.getQueryData<any>(queryKeys.reports.detail('r1'));
        expect(report.comments_count).toBe(11); // 10 base + 1 new

        // 2. Llega el evento SSE por el mismo item (simulando que RealtimeOrchestrator llama a append)
        act(() => {
            commentsCache.append(queryClient, comment as any);
        });

        // VERIFICACION: El contador NO debe haber subido a 12
        const reportAfterSSE = queryClient.getQueryData<any>(queryKeys.reports.detail('r1'));
        expect(reportAfterSSE.comments_count).toBe(11);
    });

    test('CMT-001 swapId Reconciliation: Should successfully move optimistic ID to real ID', async () => {
        const optId = 'opt-id';
        const realId = 'real-id';
        const comment = { id: optId, report_id: 'r1', content: 'Swap test', is_optimistic: true };

        act(() => {
            commentsCache.prepend(queryClient, comment as any);
        });

        expect(queryClient.getQueryData(queryKeys.comments.detail(optId))).toBeTruthy();

        // Ejecutar swap
        act(() => {
            commentsCache.swapId(queryClient, optId, realId, 'r1');
        });

        // Verificar cambio
        expect(queryClient.getQueryData(queryKeys.comments.detail(realId))).toBeTruthy();
        expect(queryClient.getQueryData<any>(queryKeys.comments.detail(realId)).is_optimistic).toBe(false);

        // Verificar que el ID en la lista cambió
        const list = queryClient.getQueryData<string[]>(queryKeys.comments.byReport('r1'));
        expect(list).toContain(realId);
        expect(list).not.toContain(optId);
    });
});
