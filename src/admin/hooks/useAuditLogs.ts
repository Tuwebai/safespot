/**
 * ============================================================================
 * AUDIT LOGS HOOK - ADMIN
 * ============================================================================
 * 
 * Hook de React Query para gestionar datos de auditoría.
 * Incluye filtros, paginación y cache.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import {
  getAuditLogs,
  getAuditLog,
  getUserAuditSummary,
  getUserTimeline,
  getAuditStats,
  getAuditActions,
  cleanupAuditLogs,
  exportLogsToCSV,
  downloadCSV,
  type AuditAction,
  type ActorType,
  type AuditLog
} from '../services/auditApi';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const auditQueryKeys = {
  all: ['audit'] as const,
  logs: (filters: AuditLogFilters) => [...auditQueryKeys.all, 'logs', filters] as const,
  log: (id: string) => [...auditQueryKeys.all, 'log', id] as const,
  userSummary: (userId: string, filters?: { startDate?: string; endDate?: string }) => 
    [...auditQueryKeys.all, 'user', userId, 'summary', filters] as const,
  userTimeline: (userId: string, filters?: { limit?: number; offset?: number }) => 
    [...auditQueryKeys.all, 'user', userId, 'timeline', filters] as const,
  stats: (filters?: { startDate?: string; endDate?: string }) => 
    [...auditQueryKeys.all, 'stats', filters] as const,
  actions: () => [...auditQueryKeys.all, 'actions'] as const,
};

// ============================================================================
// TYPES
// ============================================================================

export interface AuditLogFilters {
  actorId?: string;
  targetId?: string;
  action?: AuditAction;
  actorType?: ActorType;
  startDate?: string;
  endDate?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook para consultar logs con filtros y paginación
 */
export function useAuditLogs(initialFilters: AuditLogFilters = {}) {
  const [filters, setFilters] = useState<AuditLogFilters>({
    limit: 50,
    offset: 0,
    ...initialFilters
  });
  
  const query = useQuery({
    queryKey: auditQueryKeys.logs(filters),
    queryFn: () => getAuditLogs(filters),
    staleTime: 30 * 1000, // 30 segundos
    refetchInterval: 60 * 1000, // Refetch automático cada minuto
  });
  
  const updateFilters = useCallback((newFilters: Partial<AuditLogFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, offset: 0 })); // Reset offset en filtros nuevos
  }, []);
  
  const nextPage = useCallback(() => {
    if (query.data?.data.pagination.hasMore) {
      setFilters(prev => ({ ...prev, offset: (prev.offset || 0) + (prev.limit || 50) }));
    }
  }, [query.data?.data.pagination.hasMore]);
  
  const prevPage = useCallback(() => {
    setFilters(prev => ({ 
      ...prev, 
      offset: Math.max(0, (prev.offset || 0) - (prev.limit || 50)) 
    }));
  }, []);
  
  return {
    ...query,
    filters,
    updateFilters,
    nextPage,
    prevPage,
    canGoNext: query.data?.data.pagination.hasMore ?? false,
    canGoPrev: (filters.offset || 0) > 0,
  };
}

/**
 * Hook para obtener un log específico
 */
export function useAuditLog(id: string) {
  return useQuery({
    queryKey: auditQueryKeys.log(id),
    queryFn: () => getAuditLog(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

/**
 * Hook para resumen de actividad de usuario
 */
export function useUserAuditSummary(
  userId: string,
  filters?: { startDate?: string; endDate?: string }
) {
  return useQuery({
    queryKey: auditQueryKeys.userSummary(userId, filters),
    queryFn: () => getUserAuditSummary(userId, filters),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook para timeline de usuario
 */
export function useUserTimeline(
  userId: string,
  filters?: { limit?: number; offset?: number }
) {
  return useQuery({
    queryKey: auditQueryKeys.userTimeline(userId, filters),
    queryFn: () => getUserTimeline(userId, filters),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook para estadísticas de auditoría
 */
export function useAuditStats(filters?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: auditQueryKeys.stats(filters),
    queryFn: () => getAuditStats(filters),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // Refetch cada 5 minutos
  });
}

/**
 * Hook para lista de acciones disponibles
 */
export function useAuditActions() {
  return useQuery({
    queryKey: auditQueryKeys.actions(),
    queryFn: () => getAuditActions(),
    staleTime: Infinity, // No cambian
  });
}

/**
 * Hook para ejecutar limpieza de logs
 */
export function useCleanupAuditLogs() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: cleanupAuditLogs,
    onSuccess: () => {
      // Invalidar queries de logs y stats
      queryClient.invalidateQueries({ queryKey: auditQueryKeys.all });
    },
  });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Obtiene color para tipo de acción
 */
export function getActionColor(action: AuditAction): string {
  if (action.includes('create')) return 'text-green-400';
  if (action.includes('delete')) return 'text-red-400';
  if (action.includes('update')) return 'text-yellow-400';
  if (action.includes('hide') || action.includes('ban')) return 'text-orange-400';
  if (action.includes('login')) return 'text-blue-400';
  if (action.includes('failed')) return 'text-red-500';
  return 'text-gray-400';
}

/**
 * Obtiene icono para tipo de actor
 */
export function getActorTypeIcon(actorType: ActorType): string {
  switch (actorType) {
    case 'admin': return '👤';
    case 'system': return '⚙️';
    case 'anonymous':
    default: return '👻';
  }
}

/**
 * Formatea cambios para display
 */
export function formatChanges(oldValues: Record<string, unknown> | null, newValues: Record<string, unknown> | null, changedFields: string[] | null): string {
  if (!changedFields || changedFields.length === 0) {
    return 'Sin cambios documentados';
  }
  
  return changedFields.map(field => {
    const oldVal = oldValues?.[field] ?? '—';
    const newVal = newValues?.[field] ?? '—';
    return `${field}: "${oldVal}" → "${newVal}"`;
  }).join('\n');
}

/**
 * Exporta logs a CSV y descarga
 */
export function useExportAuditLogs() {
  return useCallback((logs: AuditLog[], filename?: string) => {
    const csv = exportLogsToCSV(logs);
    const defaultFilename = `audit-logs-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    downloadCSV(csv, filename || defaultFilename);
  }, []);
}

import { format } from 'date-fns';

// ============================================================================
// SSE (Server-Sent Events) para logs en tiempo real
// ============================================================================

import { useEffect, useRef } from 'react';

/**
 * Hook para escuchar logs de auditoría en tiempo real vía SSE
 * Actualiza automáticamente la cache de React Query cuando llega un nuevo log
 */
export function useAuditLogSSE(enabled: boolean = true) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Obtener token de admin
    const token = localStorage.getItem('safespot_admin_token');
    if (!token) return;

    // Crear conexión SSE
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const es = new EventSource(`${apiUrl}/admin/audit/stream?token=${token}`);
    eventSourceRef.current = es;

    es.onopen = () => {
      console.log('[Audit SSE] Connected');
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Ignorar heartbeats
        if (data.type === 'heartbeat') return;
        
        // Nuevo log recibido
        if (data.type === 'audit_log') {
          // Invalidar queries para refrescar datos
          queryClient.invalidateQueries({ queryKey: auditQueryKeys.all });
        }
      } catch (e) {
        // Ignorar errores de parsing
      }
    };

    es.onerror = () => {
      // Reconexión automática en 5s
      setTimeout(() => {
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          queryClient.invalidateQueries({ queryKey: auditQueryKeys.all });
        }
      }, 5000);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [enabled, queryClient]);

  return { isConnected: eventSourceRef.current?.readyState === EventSource.OPEN };
}
