/**
 * ============================================================================
 * AUDIT API SERVICE - ADMIN
 * ============================================================================
 * 
 * Servicio para consultar logs de auditoría desde el panel de admin.
 * Enterprise-grade con tipado estricto y manejo de errores.
 */

// Helper para requests admin (con auth token)
async function apiAdmin<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('safespot_admin_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...((options.headers as Record<string, string>) || {})
  };
  
  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}${endpoint}`, {
    ...options,
    headers
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// TYPES
// ============================================================================

export type ActorType = 'anonymous' | 'admin' | 'system';

export type AuditAction =
  // Reportes
  | 'report_create' | 'report_update' | 'report_delete' | 'report_view'
  | 'report_flag' | 'report_unflag' | 'report_hide' | 'report_unhide'
  // Comentarios
  | 'comment_create' | 'comment_update' | 'comment_delete'
  | 'comment_flag' | 'comment_unflag' | 'comment_hide' | 'comment_unhide'
  | 'comment_pin' | 'comment_unpin'
  // Votos
  | 'vote_create' | 'vote_delete'
  // Usuarios
  | 'user_register' | 'user_update' | 'user_delete' | 'user_ban' | 'user_unban'
  | 'user_shadow_ban' | 'user_unshadow_ban' | 'user_alias_change'
  // Auth
  | 'auth_login' | 'auth_logout' | 'auth_refresh' | 'auth_failed'
  // Moderación
  | 'moderation_resolve' | 'moderation_note_add' | 'moderation_note_delete'
  | 'admin_login' | 'admin_logout' | 'admin_action'
  // 2FA
  | 'admin_2fa_setup_initiated' | 'admin_2fa_enabled' | 'admin_2fa_disabled'
  | 'admin_2fa_failed_attempt' | 'admin_2fa_backup_codes_generated' | 'admin_2fa_backup_code_used'
  // Chat
  | 'chat_create' | 'chat_message_send' | 'chat_message_delete'
  // Sistema
  | 'system_export' | 'system_config_change' | 'api_key_created' | 'api_key_revoked';

export interface AuditLog {
  id: string;
  action_type: AuditAction;
  action_description: string | null;
  actor_type: ActorType;
  actor_id: string;
  actor_alias: string | null;
  actor_role: string | null;
  actor_ip: string | null;
  actor_user_agent: string | null;
  target_type: string | null;
  target_id: string | null;
  target_title: string | null;
  target_owner_id: string | null;
  request_id: string | null;
  session_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_fields: string[] | null;
  metadata: Record<string, unknown> | null;
  success: boolean;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

export interface AuditLogsResponse {
  success: boolean;
  data: {
    logs: AuditLog[];
    total: number;
    pagination: {
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
  meta: {
    query: Record<string, string>;
    timestamp: string;
  };
}

export interface AuditStats {
  period: { start: string; end: string };
  stats: {
    byAction: Array<{
      action_type: AuditAction;
      count: string;
      success_count: string;
      error_count: string;
    }>;
    daily: Array<{
      date: string;
      total_actions: string;
    }>;
    topActors: Array<{
      actor_type: ActorType;
      actor_id: string;
      action_count: string;
    }>;
  };
}

export interface AuditActionsResponse {
  success: boolean;
  data: {
    actions: AuditAction[];
    actionsByCategory: Record<string, AuditAction[]>;
    actorTypes: ActorType[];
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

const BASE_URL = '/api/admin/audit';

/**
 * Obtiene logs de auditoría con filtros
 */
export async function getAuditLogs(params: {
  actorId?: string;
  targetId?: string;
  action?: AuditAction;
  actorType?: ActorType;
  startDate?: string;
  endDate?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<AuditLogsResponse> {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  
  return apiAdmin<AuditLogsResponse>(`${BASE_URL}/logs?${searchParams.toString()}`);
}

/**
 * Obtiene un log específico por ID
 */
export async function getAuditLog(id: string): Promise<{ success: boolean; data: AuditLog }> {
  return apiAdmin<{ success: boolean; data: AuditLog }>(`${BASE_URL}/logs/${id}`);
}

/**
 * Obtiene resumen de actividad de un usuario
 */
export async function getUserAuditSummary(
  userId: string,
  params: { startDate?: string; endDate?: string } = {}
): Promise<{ success: boolean; data: { userId: string; period: { start: string; end: string }; summary: Array<{ action_type: string; action_count: string; last_action: string }> } }> {
  const searchParams = new URLSearchParams();
  
  if (params.startDate) searchParams.append('startDate', params.startDate);
  if (params.endDate) searchParams.append('endDate', params.endDate);
  
  return apiAdmin<{ success: boolean; data: { userId: string; period: { start: string; end: string }; summary: Array<{ action_type: string; action_count: string; last_action: string }> } }>(`${BASE_URL}/user/${userId}/summary?${searchParams.toString()}`);
}

/**
 * Obtiene timeline de un usuario
 */
export async function getUserTimeline(
  userId: string,
  params: { limit?: number; offset?: number } = {}
): Promise<{ success: boolean; data: { userId: string; timeline: AuditLog[] } }> {
  const searchParams = new URLSearchParams();
  
  if (params.limit) searchParams.append('limit', String(params.limit));
  if (params.offset) searchParams.append('offset', String(params.offset));
  
  return apiAdmin<{ success: boolean; data: { userId: string; timeline: AuditLog[] } }>(`${BASE_URL}/user/${userId}/timeline?${searchParams.toString()}`);
}

/**
 * Obtiene estadísticas generales
 */
export async function getAuditStats(params: { startDate?: string; endDate?: string } = {}): Promise<{ success: boolean; data: AuditStats }> {
  const searchParams = new URLSearchParams();
  
  if (params.startDate) searchParams.append('startDate', params.startDate);
  if (params.endDate) searchParams.append('endDate', params.endDate);
  
  return apiAdmin<{ success: boolean; data: AuditStats }>(`${BASE_URL}/stats/overview?${searchParams.toString()}`);
}

/**
 * Obtiene lista de acciones disponibles
 */
export async function getAuditActions(): Promise<AuditActionsResponse> {
  return apiAdmin<AuditActionsResponse>(`${BASE_URL}/actions`);
}

/**
 * Ejecuta limpieza de logs antiguos (solo super_admin)
 */
export async function cleanupAuditLogs(): Promise<{ success: boolean; data: { deletedCount: number; message: string } }> {
  return apiAdmin<{ success: boolean; data: { deletedCount: number; message: string } }>(`${BASE_URL}/cleanup`, { method: 'POST' });
}

/**
 * Exporta logs a CSV
 * Descarga directamente el archivo CSV
 */
export function exportLogsToCSV(logs: AuditLog[]): string {
  const headers = ['ID', 'Timestamp', 'Action', 'Actor Type', 'Actor ID', 'Actor Role', 'Target Type', 'Target ID', 'Success', 'IP', 'Description'];
  
  const rows = logs.map(log => [
    log.id,
    log.created_at,
    log.action_type,
    log.actor_type,
    log.actor_id,
    log.actor_role || '',
    log.target_type || '',
    log.target_id || '',
    log.success ? 'Yes' : 'No',
    log.actor_ip || '',
    log.action_description || ''
  ]);
  
  const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
  
  return csvContent;
}

/**
 * Descarga CSV como archivo
 */
export function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
