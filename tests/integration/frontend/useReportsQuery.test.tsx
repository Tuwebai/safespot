import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReportsQuery } from '../../../src/hooks/queries/useReportsQuery';
import type { ReactNode } from 'react';

/**
 * Integration Tests: useReportsQuery (Background Refetch)
 * 
 * Objetivo: Validar que el hook mantiene "Last Known Good State" durante refetch.
 * 
 * Criticidad: CRÍTICA - Bug histórico: refetch causaba que UI mostrara "0 reportes".
 * 
 * Cobertura:
 * - Render inicial con datos
 * - Background refetch NO pierde datos
 * - placeholderData mantiene datos previos
 */

// Mock de la API
vi.mock('@/lib/api', () => ({
    reportsApi: {
        getAll: vi.fn()
    }
}));

// Mock de useAnonymousId
vi.mock('@/hooks/useAnonymousId', () => ({
    useAnonymousId: () => 'test-anonymous-id-123'
}));

import { reportsApi } from '@/lib/api';

describe('useReportsQuery - Background Refetch (Last Known Good State)', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        // Reset query client para cada test
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false, // Deshabilitar retry para tests
                },
            },
        });
        vi.clearAllMocks();
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );

    it('Debe renderizar con datos iniciales correctamente', async () => {
        const mockReports = [
            { id: 'report-1', title: 'Reporte 1' },
            { id: 'report-2', title: 'Reporte 2' }
        ];

        vi.mocked(reportsApi.getAll).mockResolvedValueOnce(mockReports as any);

        const { result } = renderHook(() => useReportsQuery(), { wrapper });

        // Estado inicial: loading
        expect(result.current.isLoading).toBe(true);
        expect(result.current.data).toBeUndefined();

        // Esperar a que carguen los datos
        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        // Validar que los datos están presentes y enriquecidos
        expect(result.current.data?.[0]).toMatchObject({ id: 'report-1', title: 'Reporte 1' });
        expect(result.current.data?.length).toBe(2);
        expect(result.current.isLoading).toBe(false);
    });

    it('CRÍTICO: Background refetch NO debe perder datos (Last Known Good State)', async () => {
        const initialReports = [
            { id: 'report-1', title: 'Reporte 1' },
            { id: 'report-2', title: 'Reporte 2' }
        ];

        vi.mocked(reportsApi.getAll).mockResolvedValueOnce(initialReports as any);

        const { result } = renderHook(() => useReportsQuery(), { wrapper });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.[0].id).toBe('report-1');

        const updatedReports = [
            { id: 'report-1', title: 'Reporte 1' },
            { id: 'report-2', title: 'Reporte 2' },
            { id: 'report-3', title: 'Reporte 3 (nuevo)' }
        ];

        vi.mocked(reportsApi.getAll).mockResolvedValueOnce(updatedReports as any);

        await result.current.refetch();

        expect(result.current.data).toBeDefined();
        expect(result.current.data?.length).toBeGreaterThan(0);

        await waitFor(() => {
            expect(result.current.isFetching).toBe(false);
        });

        expect(result.current.data?.[2].id).toBe('report-3');
    });

    it('CRÍTICO: Si el backend devuelve datos inválidos, debe mantener datos previos', async () => {
        const initialReports = [
            { id: 'report-1', title: 'Reporte 1' }
        ];

        vi.mocked(reportsApi.getAll).mockResolvedValueOnce(initialReports as any);

        const { result } = renderHook(() => useReportsQuery(), { wrapper });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.[0].id).toBe('report-1');

        vi.mocked(reportsApi.getAll).mockResolvedValueOnce(null as any);

        await result.current.refetch();

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        // Los datos previos deben mantenerse (Last Known Good State)
        expect(result.current.data?.[0].id).toBe('report-1');
    });
});
