/**
 * ============================================================================
 * AUDIT PAGE - ADMIN
 * ============================================================================
 * 
 * Página de auditoría enterprise para consulta de logs.
 * Incluye filtros avanzados, paginación y visualización detallada.
 */

import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Calendar, 
  Activity,
  CheckCircle,
  XCircle,
  Eye,
  Download,
  AlertTriangle
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { useAuditLogs, useAuditActions, useAuditStats, useAuditLogSSE, getActionColor, type AuditLogFilters } from '../hooks/useAuditLogs';
import type { AuditLog, AuditAction } from '../services/auditApi';
import { exportLogsToCSV, downloadCSV } from '../services/auditApi';

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

/**
 * Badge para tipo de acción
 */
function ActionBadge({ action }: { action: string }) {
  const colorClass = getActionColor(action as never);
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass} bg-opacity-10`}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

/**
 * Badge para tipo de actor
 */
function ActorBadge({ type }: { type: string }) {
  const colors = {
    admin: 'bg-purple-500/20 text-purple-400',
    anonymous: 'bg-gray-500/20 text-gray-400',
    system: 'bg-blue-500/20 text-blue-400'
  };
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${colors[type as keyof typeof colors] || colors.anonymous}`}>
      {type}
    </span>
  );
}

/**
 * Badge para estado de éxito
 */
function SuccessBadge({ success }: { success: boolean }) {
  return success ? (
    <span className="inline-flex items-center text-green-400">
      <CheckCircle className="w-4 h-4 mr-1" />
      <span className="text-xs">OK</span>
    </span>
  ) : (
    <span className="inline-flex items-center text-red-400">
      <XCircle className="w-4 h-4 mr-1" />
      <span className="text-xs">Error</span>
    </span>
  );
}

/**
 * Modal de detalle de log
 */
function LogDetailModal({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  return (
    <Modal open={true} onOpenChange={(open) => !open && onClose()} title="Detalle de Auditoría">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">{log.action_type}</h3>
            <p className="text-sm text-gray-400">{log.action_description || 'Sin descripción'}</p>
          </div>
          <SuccessBadge success={log.success} />
        </div>
        
        {/* Actor Info */}
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center">
            <User className="w-4 h-4 mr-2" />
            Actor
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Tipo:</span>
              <ActorBadge type={log.actor_type} />
            </div>
            <div>
              <span className="text-gray-500">ID:</span>
              <code className="ml-2 text-xs bg-gray-700 px-2 py-0.5 rounded">{log.actor_id}</code>
            </div>
            {log.actor_alias && (
              <div>
                <span className="text-gray-500">Alias:</span>
                <span className="ml-2 text-emerald-400 font-medium">{log.actor_alias}</span>
              </div>
            )}
            {log.actor_role && (
              <div>
                <span className="text-gray-500">Rol:</span>
                <span className="ml-2 text-gray-300">{log.actor_role}</span>
              </div>
            )}
            {log.actor_ip && (
              <div>
                <span className="text-gray-500">IP:</span>
                <code className="ml-2 text-xs bg-gray-700 px-2 py-0.5 rounded">{log.actor_ip}</code>
              </div>
            )}
          </div>
        </div>
        
        {/* Target Info */}
        {log.target_type && (
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Target</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Tipo:</span>
                <span className="ml-2 text-gray-300">{log.target_type}</span>
              </div>
              {log.target_id && (
                <div>
                  <span className="text-gray-500">ID:</span>
                  <code className="ml-2 text-xs bg-gray-700 px-2 py-0.5 rounded">{log.target_id}</code>
                </div>
              )}
              {log.target_title && (
                <div className="col-span-2">
                  <span className="text-gray-500">Título:</span>
                  <span className="ml-2 text-emerald-400 font-medium">{log.target_title}</span>
                </div>
              )}
              {log.target_owner_id && (
                <div>
                  <span className="text-gray-500">Owner:</span>
                  <code className="ml-2 text-xs bg-gray-700 px-2 py-0.5 rounded">{log.target_owner_id}</code>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Changes */}
        {(log.old_values || log.new_values) && (
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Cambios</h4>
            
            {log.changed_fields && (
              <div className="mb-3">
                <span className="text-xs text-gray-500">Campos modificados:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {log.changed_fields.map((field: string) => (
                    <span key={field} className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              {log.old_values && (
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Valores anteriores:</span>
                  <pre className="text-xs bg-gray-900 p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(log.old_values, null, 2)}
                  </pre>
                </div>
              )}
              {log.new_values && (
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Valores nuevos:</span>
                  <pre className="text-xs bg-gray-900 p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(log.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Metadata */}
        {log.metadata && Object.keys(log.metadata).length > 0 && (
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Metadata</h4>
            <pre className="text-xs bg-gray-900 p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </div>
        )}
        
        {/* Error Info */}
        {!log.success && (log.error_code || log.error_message) && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <h4 className="text-sm font-medium text-red-400 mb-3 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Error
            </h4>
            {log.error_code && (
              <div className="text-sm mb-2">
                <span className="text-gray-500">Código:</span>
                <code className="ml-2 text-red-400">{log.error_code}</code>
              </div>
            )}
            {log.error_message && (
              <div className="text-sm">
                <span className="text-gray-500">Mensaje:</span>
                <p className="mt-1 text-gray-300">{log.error_message}</p>
              </div>
            )}
          </div>
        )}
        
        {/* Footer Info */}
        <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-700 pt-4">
          <div>
            <span>ID: </span>
            <code>{log.id}</code>
          </div>
          {log.request_id && (
            <div>
              <span>Request: </span>
              <code>{log.request_id}</code>
            </div>
          )}
          <div className="flex items-center">
            <Calendar className="w-3 h-3 mr-1" />
            {format(new Date(log.created_at), 'PPpp', { locale: es })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function AuditPage() {
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showStats, setShowStats] = useState(false);
  
  const {
    data,
    isLoading,
    error,
    filters,
    updateFilters,
    nextPage,
    prevPage,
    canGoNext,
    canGoPrev
  } = useAuditLogs({ limit: 50 });
  
  const { data: actionsData } = useAuditActions();
  const { data: statsData } = useAuditStats();
  
  // SSE para logs en tiempo real
  const { isConnected } = useAuditLogSSE(true);
  
  const logs = data?.data.logs ?? [];
  const total = data?.data.total ?? 0;
  
  // Export handler
  const handleExport = () => {
    if (logs.length === 0) return;
    const csv = exportLogsToCSV(logs);
    const filename = `audit-logs-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    downloadCSV(csv, filename);
  };
  
  // Handlers
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateFilters({
      actorId: formData.get('actorId') as string || undefined,
      targetId: formData.get('targetId') as string || undefined,
      action: (formData.get('action') as AuditAction) || undefined,
      actorType: (formData.get('actorType') as AuditLogFilters['actorType']) || undefined,
    });
  };
  
  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    updateFilters({ [field]: value || undefined });
  };
  
  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-400 mb-2">Error al cargar logs</h2>
          <p className="text-gray-400">{error.message}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Activity className="w-6 h-6 mr-2 text-emerald-400" />
            Auditoría
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Logs de actividad del sistema para compliance y trazabilidad
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="flex items-center text-xs text-gray-400">
            <span className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
            {isConnected ? 'Tiempo real' : 'Polling'}
          </span>
          <span className="text-sm text-gray-400">
            {total.toLocaleString()} registros
          </span>
          <button
            onClick={() => setShowStats(!showStats)}
            className="flex items-center px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
          >
            <Activity className="w-4 h-4 mr-2" />
            {showStats ? 'Ocultar Stats' : 'Ver Stats'}
          </button>
          <button
            onClick={handleExport}
            disabled={logs.length === 0}
            className="flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </button>
        </div>
      </div>
      
      {/* Filtros */}
      <div className="bg-gray-800/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center text-sm text-gray-300 hover:text-white transition-colors"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </button>
          {(filters.actorId || filters.targetId || filters.action) && (
            <button
              onClick={() => updateFilters({ actorId: undefined, targetId: undefined, action: undefined, actorType: undefined })}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Limpiar filtros
            </button>
          )}
        </div>
        
        <form onSubmit={handleSearch} className={`space-y-4 ${showFilters ? '' : 'hidden'}`}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Actor ID</label>
              <input
                name="actorId"
                type="text"
                defaultValue={filters.actorId}
                placeholder="UUID del actor..."
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Target ID</label>
              <input
                name="targetId"
                type="text"
                defaultValue={filters.targetId}
                placeholder="UUID del recurso..."
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Acción</label>
              <select
                name="action"
                defaultValue={filters.action}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">Todas las acciones</option>
                {actionsData?.data.actionsByCategory && Object.entries(actionsData.data.actionsByCategory).map(([category, actions]) => (
                  <optgroup key={category} label={category}>
                    {actions.map(action => (
                      <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo Actor</label>
              <select
                name="actorType"
                defaultValue={filters.actorType}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">Todos</option>
                <option value="anonymous">Anonymous</option>
                <option value="admin">Admin</option>
                <option value="system">System</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha inicio</label>
              <input
                type="datetime-local"
                value={filters.startDate?.slice(0, 16) || ''}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha fin</label>
              <input
                type="datetime-local"
                value={filters.endDate?.slice(0, 16) || ''}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm transition-colors"
            >
              <Search className="w-4 h-4 mr-2" />
              Aplicar filtros
            </button>
          </div>
        </form>
      </div>
      
      {/* Dashboard de Estadísticas */}
      {showStats && statsData?.data && (
        <div className="bg-gray-800/50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-emerald-400" />
            Dashboard de Actividad
          </h2>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Total Acciones</div>
              <div className="text-2xl font-bold text-white">
                {statsData.data.stats.byAction.reduce((sum, a) => sum + parseInt(a.count), 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Éxitos</div>
              <div className="text-2xl font-bold text-green-400">
                {statsData.data.stats.byAction.reduce((sum, a) => sum + parseInt(a.success_count), 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Errores</div>
              <div className="text-2xl font-bold text-red-400">
                {statsData.data.stats.byAction.reduce((sum, a) => sum + parseInt(a.error_count), 0).toLocaleString()}
              </div>
            </div>
          </div>
          
          {/* Top Actions */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Acciones Más Frecuentes</h3>
            <div className="space-y-2">
              {statsData.data.stats.byAction.slice(0, 5).map((action) => (
                <div key={action.action_type} className="flex items-center justify-between bg-gray-700/30 rounded px-3 py-2">
                  <span className="text-sm text-gray-300">{action.action_type.replace(/_/g, ' ')}</span>
                  <div className="flex items-center space-x-4">
                    <span className="text-xs text-gray-500">{action.count} total</span>
                    <div className="w-24 bg-gray-600 rounded-full h-2">
                      <div 
                        className="bg-emerald-500 h-2 rounded-full" 
                        style={{ width: `${Math.min(100, (parseInt(action.success_count) / Math.max(1, parseInt(action.count))) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Daily Activity */}
          {statsData.data.stats.daily.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Actividad Diaria (últimos 7 días)</h3>
              <div className="flex items-end space-x-2 h-24">
                {statsData.data.stats.daily.slice(0, 7).map((day, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-emerald-500/50 rounded-t" 
                      style={{ height: `${Math.max(20, (parseInt(day.total_actions) / Math.max(1, ...statsData.data.stats.daily.map(d => parseInt(d.total_actions)))) * 80)}px` }}
                    />
                    <span className="text-xs text-gray-500 mt-1">
                      {format(new Date(day.date), 'dd/MM')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Tabla */}
      <div className="bg-gray-800/30 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-400">Cargando logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No se encontraron logs con los filtros aplicados</p>
          </div>
        ) : (
          <>
            <table className="w-full text-left">
              <thead className="bg-gray-700/50 text-gray-300 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Acción</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                      {format(new Date(log.created_at), 'PPp', { locale: es })}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={log.action_type} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <ActorBadge type={log.actor_type} />
                        {log.actor_alias ? (
                          <span className="text-sm text-gray-200" title={log.actor_id}>
                            {log.actor_alias}
                          </span>
                        ) : (
                          <code className="text-xs text-gray-400 truncate max-w-[100px]">
                            {log.actor_id.slice(0, 8)}...
                          </code>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {log.target_type ? (
                        <div className="text-sm">
                          {log.target_title ? (
                            <span className="text-gray-200" title={`${log.target_type}: ${log.target_id}`}>
                              {log.target_title.length > 30 
                                ? log.target_title.slice(0, 30) + '...' 
                                : log.target_title}
                            </span>
                          ) : (
                            <>
                              <span className="text-gray-500">{log.target_type}:</span>
                              <code className="ml-1 text-xs text-gray-400">
                                {log.target_id?.slice(0, 8)}...
                              </code>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <SuccessBadge success={log.success} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                        title="Ver detalle"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Paginación */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-700/30 border-t border-gray-700">
              <div className="text-sm text-gray-400">
                Mostrando {logs.length} de {total} resultados
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={prevPage}
                  disabled={!canGoPrev}
                  className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-400">
                  Página {Math.floor((filters.offset || 0) / (filters.limit || 50)) + 1}
                </span>
                <button
                  onClick={nextPage}
                  disabled={!canGoNext}
                  className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Modal de detalle */}
      {selectedLog && (
        <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
