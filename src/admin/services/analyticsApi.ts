/**
 * ============================================================================
 * ANALYTICS API SERVICE
 * ============================================================================
 * 
 * Servicio para consultar métricas de analytics desde el admin.
 */

import { adminApi } from './adminApi';

export interface AnalyticsKPIs {
  dau_yesterday: number;
  mau: number;
  stickiness: number; // 0.15 = 15%
  total_reports: number;
  total_comments: number;
  total_votes: number;
  avg_session_duration_seconds: number;
}

export interface TimeSeriesData {
  labels: string[];
  datasets: {
    dau: number[];
    new_users: number[];
    returning_users: number[];
  };
}

export interface DailyMetric {
  date: string;
  dau: number;
  new_users: number;
  returning_users: number;
  total_sessions: number;
  avg_session_duration_seconds: number | null;
  reports_created: number;
  comments_created: number;
  votes_cast: number;
  calculated_at: string;
}

export interface AnalyticsResponse {
  kpis: AnalyticsKPIs;
  timeSeries: TimeSeriesData;
  daily: DailyMetric[];
}

/**
 * Obtiene métricas de analytics
 * @param days - Número de días (7, 14, 30, 60, 90)
 */
export async function getAnalytics(days: number = 30): Promise<AnalyticsResponse> {
  const { data } = await adminApi.get<AnalyticsResponse>('/analytics', {
    params: { days }
  });
  return data;
}

/**
 * Fuerza recálculo de métricas (super_admin only)
 */
export async function recalculateAnalytics(date?: string): Promise<{ success: boolean; message: string }> {
  const { data } = await adminApi.post<{ success: boolean; message: string }>('/analytics/recalculate', {
    date
  });
  return data;
}

/**
 * Ejecuta job de analytics (super_admin only, para Render Cron)
 */
export async function runAnalyticsCron(): Promise<{ success: boolean; message: string }> {
  const { data } = await adminApi.post<{ success: boolean; message: string }>('/analytics/run-cron');
  return data;
}

/**
 * Exporta métricas a CSV
 * Descarga archivo directamente
 */
export function exportAnalyticsCSV(days: number = 30): void {
  const token = localStorage.getItem('safespot_admin_token');
  const url = `${import.meta.env.VITE_API_URL || ''}/api/admin/analytics/export?days=${days}&token=${token}`;
  
  // Crear link temporal para descarga
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `analytics-${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Formatea segundos a legible (4m 32s)
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return '0s';
  
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

/**
 * Formatea número con separador de miles
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('es-AR');
}

/**
 * Formatea porcentaje (0.15 → 15%)
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
