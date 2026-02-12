/**
 * ============================================================================
 * USE ANALYTICS ADMIN - Hook para dashboard de analytics
 * ============================================================================
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAnalytics,
  recalculateAnalytics,
  runAnalyticsCron,
  exportAnalyticsCSV,
  formatDuration,
  formatNumber,
  formatPercent,
  type AnalyticsResponse
} from '../services/analyticsApi';
import { useToast } from '@/components/ui/toast/useToast';

const ANALYTICS_KEY = ['admin', 'analytics'] as const;

/**
 * Hook para obtener métricas de analytics
 */
export function useAnalyticsAdmin(days: number = 30) {
  return useQuery<AnalyticsResponse>({
    queryKey: [...ANALYTICS_KEY, days],
    queryFn: () => getAnalytics(days),
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchInterval: 5 * 60 * 1000, // Auto-refetch cada 5 min
  });
}

/**
 * Hook para recalcular métricas (super_admin)
 */
export function useRecalculateAnalytics() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: recalculateAnalytics,
    onSuccess: () => {
      success('Métricas recalculadas exitosamente');
      queryClient.invalidateQueries({ queryKey: ANALYTICS_KEY });
    },
    onError: (err: Error) => {
      error(err.message || 'Error al recalcular métricas');
    }
  });
}

/**
 * Hook para ejecutar cron job (super_admin)
 */
export function useRunAnalyticsCron() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: runAnalyticsCron,
    onSuccess: (data) => {
      success(data.message);
      queryClient.invalidateQueries({ queryKey: ANALYTICS_KEY });
    },
    onError: (err: Error) => {
      error(err.message || 'Error al ejecutar cron job');
    }
  });
}

/**
 * Hook para exportar CSV
 */
export function useExportAnalyticsCSV() {
  const { success } = useToast();

  return (days: number = 30) => {
    exportAnalyticsCSV(days);
    success('Descargando CSV...');
  };
}

// Re-exportar utilidades
export { formatDuration, formatNumber, formatPercent };
