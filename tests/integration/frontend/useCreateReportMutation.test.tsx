import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateReportMutation } from '../../../src/hooks/mutations/useCreateReportMutation';
import { useReportsQuery } from '../../../src/hooks/queries/useReportsQuery';
import { reportsApi } from '../../../src/lib/api';
import { setupQueryContracts } from '../../../src/lib/queryClient';
import type { ReactNode } from 'react';

// Mock de la API
vi.mock('../../../src/lib/api', () => ({
    reportsApi: {
        getAll: vi.fn(),
        create: vi.fn()
    }
}));

// Mock de Auth
vi.mock('../../../src/hooks/useAuthGuard', () => ({
    useAuthGuard: () => ({ checkAuth: () => true })
}));

// Mock de useAnonymousId
vi.mock('../../../src/hooks/useAnonymousId', () => ({
    useAnonymousId: () => 'test-id-123'
}));

describe('CONTRACT #OPT-001: 0ms Optimistic Report Creation', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false, staleTime: Infinity },
                mutations: { retry: false }
            },
        });

        // Aplicar Hard Assertions al cliente de test
        setupQueryContracts(queryClient);

        vi.clearAllMocks();
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );

    it('Debe insertar el reporte en cache instantáneamente (0ms) sin esperar al servidor', async () => {
        const mockInitialReports = [
            { id: 'old-1', title: 'Antiguo' }
        ];

        vi.mocked(reportsApi.getAll).mockResolvedValue(mockInitialReports as any);

        // Cargar lista inicial
        const { result: reportsHook } = renderHook(() => useReportsQuery(), { wrapper });
        await waitFor(() => expect(reportsHook.current.isSuccess).toBe(true));
        expect(reportsHook.current.data?.length).toBe(1);

        // Configurar POST que tarda 2 segundos para validar "percepción 0ms"
        let resolveMutation: any;
        const mutationPromise = new Promise((resolve) => { resolveMutation = resolve; });
        vi.mocked(reportsApi.create).mockImplementation(() => mutationPromise as any);

        const { result: createHook } = renderHook(() => useCreateReportMutation(), { wrapper });

        const newReportData = {
            title: 'Nuevo Reporte Optimista',
            description: 'Descripción larga para pasar validación',
            category: 'robo',
            zone: 'Test',
            address: 'Calle 123',
            latitude: -34,
            longitude: -58
        };

        // Ejecutar mutación
        createHook.current.mutate(newReportData);

        // ASSERTION 1: El reporte debe aparecer en la lista (re-renderizado)
        await waitFor(() => {
            expect(reportsHook.current.data?.length).toBe(2);
            expect(reportsHook.current.data?.[0]).toMatchObject({
                title: newReportData.title,
                _isOptimistic: true
            });
        }, { timeout: 1000 });

        // ASSERTION 2: No debe haber refetching (lo que causaría flickering)
        expect(reportsHook.current.isFetching).toBe(false);

        // Resolver mutación
        const serverResponse = {
            ...newReportData,
            id: 'server-id-999',
            author: { id: 'u1', alias: 'u', avatarUrl: 'v', isAuthor: true, is_official: false, role: 'citizen' },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            comments_count: 0,
            upvotes_count: 0,
            status: 'pendiente'
        };
        resolveMutation(serverResponse);

        // ASSERTION 3: El reporte optimista se reconcilia con el del servidor
        await waitFor(() => {
            expect(reportsHook.current.data?.[0].id).toBe('server-id-999');
            expect(reportsHook.current.data?.[0]._isOptimistic).toBe(false);
        });
    });

    it('Debe aplicar el cambio a todas las variaciones de cache (exact: false)', async () => {
        vi.mocked(reportsApi.getAll).mockResolvedValue([]);

        const { result: hookAll } = renderHook(() => useReportsQuery(), { wrapper });
        const { result: hookRobo } = renderHook(() => useReportsQuery({ category: 'robo' }), { wrapper });

        await waitFor(() => {
            expect(hookAll.current.isSuccess).toBe(true);
            expect(hookRobo.current.isSuccess).toBe(true);
        });

        const { result: createHook } = renderHook(() => useCreateReportMutation(), { wrapper });

        createHook.current.mutate({
            title: 'Reporte de Robo',
            description: '...',
            category: 'robo',
            zone: 'X',
            address: 'Y'
        });

        await waitFor(() => {
            expect(hookAll.current.data?.length).toBe(1);
            expect(hookRobo.current.data?.length).toBe(1);
        }, { timeout: 2000 });
    });

    it('CONTRACT #OPT-001: Debe bloquear la invalidación manual de reportes (Hard Assertion)', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        await queryClient.invalidateQueries({ queryKey: ['reports', 'list'] });

        // Verificar que se disparó la Hard Assertion de contrato
        expect(errorSpy).toHaveBeenCalled();
        expect(errorSpy.mock.calls[0][0]).toContain('[QueryClient] ❌ CRITICAL CONTRACT VIOLATION #OPT-001');
    });
});
