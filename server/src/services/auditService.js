/**
 * ============================================================================
 * AUDIT LOGGING SERVICE - ENTERPRISE GRADE
 * ============================================================================
 * 
 * Responsabilidad: Registrar TODAS las acciones sensibles del sistema
 * de forma inmutable y trazable para compliance (GDPR, etc.)
 * 
 * Características Enterprise:
 * - Batching asíncrono para performance
 * - Validación estricta de datos
 * - Sanitización de PII
 * - Integración con correlation IDs
 * - Fallback a archivo local si DB falla
 * 
 * @module services/auditService
 * @requires ../config/database
 * @requires ../middleware/correlation
 * @requires ../utils/logger
 */

import pool from '../config/database.js';
import { getCorrelationId } from '../middleware/correlation.js';
import logger from '../utils/logger.js';

/**
 * Tipos de actor soportados
 * @readonly
 * @enum {string}
 */
export const ActorType = {
    ANONYMOUS: 'anonymous',
    ADMIN: 'admin',
    SYSTEM: 'system'
};

/**
 * Tipos de acciones auditables
 * @readonly
 * @enum {string}
 */
export const AuditAction = {
    // Reportes
    REPORT_CREATE: 'report_create',
    REPORT_UPDATE: 'report_update',
    REPORT_DELETE: 'report_delete',
    REPORT_VIEW: 'report_view',
    REPORT_FLAG: 'report_flag',
    REPORT_UNFLAG: 'report_unflag',
    REPORT_HIDE: 'report_hide',
    REPORT_UNHIDE: 'report_unhide',
    
    // Comentarios
    COMMENT_CREATE: 'comment_create',
    COMMENT_UPDATE: 'comment_update',
    COMMENT_DELETE: 'comment_delete',
    COMMENT_FLAG: 'comment_flag',
    COMMENT_UNFLAG: 'comment_unflag',
    COMMENT_HIDE: 'comment_hide',
    COMMENT_UNHIDE: 'comment_unhide',
    COMMENT_PIN: 'comment_pin',
    COMMENT_UNPIN: 'comment_unpin',
    
    // Votos
    VOTE_CREATE: 'vote_create',
    VOTE_DELETE: 'vote_delete',
    
    // Usuarios
    USER_REGISTER: 'user_register',
    USER_UPDATE: 'user_update',
    USER_DELETE: 'user_delete',
    USER_BAN: 'user_ban',
    USER_UNBAN: 'user_unban',
    USER_SHADOW_BAN: 'user_shadow_ban',
    USER_UNSHADOW_BAN: 'user_unshadow_ban',
    USER_ALIAS_CHANGE: 'user_alias_change',
    
    // Auth
    AUTH_LOGIN: 'auth_login',
    AUTH_LOGOUT: 'auth_logout',
    AUTH_REFRESH: 'auth_refresh',
    AUTH_FAILED: 'auth_failed',
    
    // Admin/Moderación
    MODERATION_RESOLVE: 'moderation_resolve',
    MODERATION_NOTE_ADD: 'moderation_note_add',
    MODERATION_NOTE_DELETE: 'moderation_note_delete',
    ADMIN_LOGIN: 'admin_login',
    ADMIN_LOGOUT: 'admin_logout',
    ADMIN_ACTION: 'admin_action',
    
    // Chat
    CHAT_CREATE: 'chat_create',
    CHAT_MESSAGE_SEND: 'chat_message_send',
    CHAT_MESSAGE_DELETE: 'chat_message_delete',
    
    // Sistema
    SYSTEM_EXPORT: 'system_export',
    SYSTEM_CONFIG_CHANGE: 'system_config_change',
    API_KEY_CREATED: 'api_key_created',
    API_KEY_REVOKED: 'api_key_revoked'
};

/**
 * Campos sensibles que deben ser enmascarados/excluidos de los logs
 * @readonly
 * @type {string[]}
 */
const SENSITIVE_FIELDS = [
    'password', 'token', 'secret', 'api_key', 'private_key',
    'credit_card', 'ssn', 'document_number', 'phone',
    'email', 'address', 'location_details'
];

/**
 * Cola de logs pendientes para batching
 * @private
 * @type {Array<Object>}
 */
let pendingLogs = [];

/**
 * Timer para flush automático
 * @private
 */
let flushTimer = null;

/**
 * Configuración del batching
 * @private
 */
const BATCH_CONFIG = {
    maxSize: 50,           // Máximo de logs en cola antes de flush forzado
    flushIntervalMs: 5000, // Flush cada 5 segundos
    maxRetries: 3          // Reintentos antes de fallback
};

/**
 * ============================================================================
 * FUNCIONES PÚBLICAS
 * ============================================================================
 */

/**
 * Registra una acción en el sistema de auditoría
 * 
 * @param {Object} params - Parámetros del log
 * @param {AuditAction} params.action - Tipo de acción
 * @param {string} [params.description] - Descripción legible de la acción
 * @param {ActorType} params.actorType - Tipo de actor (anonymous/admin/system)
 * @param {string} params.actorId - ID del actor (UUID)
 * @param {string} [params.actorRole] - Rol del actor
 * @param {Object} [params.req] - Request de Express (para extraer IP, UA, etc.)
 * @param {string} [params.targetType] - Tipo de recurso afectado
 * @param {string} [params.targetId] - ID del recurso afectado
 * @param {string} [params.targetOwnerId] - ID del dueño del recurso
 * @param {Object} [params.oldValues] - Valores anteriores (para UPDATE/DELETE)
 * @param {Object} [params.newValues] - Valores nuevos (para CREATE/UPDATE)
 * @param {string[]} [params.changedFields] - Campos que cambiaron
 * @param {Object} [params.metadata] - Metadatos adicionales
 * @param {boolean} [params.success=true] - Si la acción fue exitosa
 * @param {string} [params.errorCode] - Código de error (si falló)
 * @param {string} [params.errorMessage] - Mensaje de error (si falló)
 * @returns {Promise<boolean>} - true si se registró correctamente
 * 
 * @example
 * await auditLog({
 *   action: AuditAction.REPORT_CREATE,
 *   actorType: ActorType.ANONYMOUS,
 *   actorId: req.headers['x-anonymous-id'],
 *   req,
 *   targetType: 'report',
 *   targetId: report.id,
 *   newValues: { title: report.title, category: report.category },
 *   metadata: { imageCount: 2 }
 * });
 */
export async function auditLog(params) {
    try {
        // Validación estricta de parámetros obligatorios
        if (!params.action) {
            throw new Error('auditLog: action is required');
        }
        if (!params.actorType) {
            throw new Error('auditLog: actorType is required');
        }
        if (!params.actorId) {
            throw new Error('auditLog: actorId is required');
        }

        // Construir entrada de auditoría
        const logEntry = buildLogEntry(params);
        
        // Agregar a cola de batching
        pendingLogs.push(logEntry);
        
        // Forzar flush si alcanzamos el tamaño máximo
        if (pendingLogs.length >= BATCH_CONFIG.maxSize) {
            await flushAuditLogs();
        } else if (!flushTimer) {
            // Iniciar timer para flush automático
            scheduleFlush();
        }
        
        return true;
    } catch (error) {
        // Nunca debe fallar el flujo principal por auditoría
        logger.error('Audit logging failed', { error: error.message, params: sanitizeForLog(params) });
        
        // Fallback: escribir a archivo local o stderr
        fallbackLog(params, error);
        
        return false;
    }
}

/**
 * Registra una acción de forma síncrona (para casos críticos)
 * Útil para operaciones que requieren inmediatez (login, delete)
 * 
 * @param {Object} params - Mismos parámetros que auditLog
 * @returns {Promise<boolean>}
 */
export async function auditLogSync(params) {
    try {
        const logEntry = buildLogEntry(params);
        
        // Insertar inmediatamente, sin batching
        await insertSingleLog(logEntry);
        
        return true;
    } catch (error) {
        logger.error('Synchronous audit logging failed', { error: error.message });
        fallbackLog(params, error);
        return false;
    }
}

/**
 * Fuerza el flush de logs pendientes
 * Útil para graceful shutdown o tests
 * 
 * @returns {Promise<number>} - Cantidad de logs flushados
 */
export async function flushAuditLogs() {
    if (pendingLogs.length === 0) {
        return 0;
    }
    
    const logsToFlush = [...pendingLogs];
    pendingLogs = [];
    
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    
    try {
        await insertBatchLogs(logsToFlush);
        return logsToFlush.length;
    } catch (error) {
        // Reintentar una vez
        logger.warn('Audit log batch insert failed, retrying...', { error: error.message });
        try {
            await insertBatchLogs(logsToFlush);
            return logsToFlush.length;
        } catch (retryError) {
            // Fallback: log individualmente
            logger.error('Audit log batch failed after retry', { error: retryError.message });
            for (const log of logsToFlush) {
                fallbackLog(log, retryError);
            }
            return 0;
        }
    }
}

/**
 * Consulta logs de auditoría (para panel admin)
 * 
 * @param {Object} filters - Filtros de búsqueda
 * @param {string} [filters.actorId] - Filtrar por actor
 * @param {string} [filters.targetId] - Filtrar por target
 * @param {string} [filters.action] - Filtrar por tipo de acción
 * @param {Date} [filters.startDate] - Fecha inicio
 * @param {Date} [filters.endDate] - Fecha fin
 * @param {number} [filters.limit=50] - Límite de resultados
 * @param {number} [filters.offset=0] - Offset para paginación
 * @returns {Promise<{logs: Array, total: number}>}
 */
export async function queryAuditLogs(filters = {}) {
    const {
        actorId,
        targetId,
        action,
        startDate,
        endDate,
        limit = 50,
        offset = 0
    } = filters;
    
    const conditions = ['1=1'];
    const params = [];
    let paramIndex = 1;
    
    if (actorId) {
        conditions.push(`actor_id = $${paramIndex++}`);
        params.push(actorId);
    }
    
    if (targetId) {
        conditions.push(`target_id = $${paramIndex++}`);
        params.push(targetId);
    }
    
    if (action) {
        conditions.push(`action_type = $${paramIndex++}`);
        params.push(action);
    }
    
    if (startDate) {
        conditions.push(`created_at >= $${paramIndex++}`);
        params.push(startDate);
    }
    
    if (endDate) {
        conditions.push(`created_at <= $${paramIndex++}`);
        params.push(endDate);
    }
    
    const whereClause = conditions.join(' AND ');
    params.push(limit, offset);
    
    const query = `
        SELECT 
            id, action_type, action_description, actor_type, actor_id,
            actor_role, actor_alias, actor_ip, target_type, target_id, 
            target_title, target_owner_id, request_id, old_values, new_values, 
            changed_fields, metadata, success, error_code, error_message, created_at
        FROM audit_logs
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    
    const countQuery = `
        SELECT COUNT(*) as total
        FROM audit_logs
        WHERE ${whereClause}
    `;
    
    const client = await pool.connect();
    try {
        const [logsResult, countResult] = await Promise.all([
            client.query(query, params),
            client.query(countQuery, params.slice(0, -2)) // Sin limit/offset
        ]);
        
        return {
            logs: logsResult.rows,
            total: parseInt(countResult.rows[0].total, 10)
        };
    } finally {
        client.release();
    }
}

/**
 * Obtiene resumen de actividad para un usuario específico
 * 
 * @param {string} userId - ID del usuario
 * @param {Date} startDate - Fecha inicio
 * @param {Date} endDate - Fecha fin
 * @returns {Promise<Array>}
 */
export async function getUserActivitySummary(userId, startDate, endDate) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT * FROM get_user_audit_summary($1, $2, $3)`,
            [userId, startDate, endDate]
        );
        return result.rows;
    } finally {
        client.release();
    }
}

/**
 * ============================================================================
 * FUNCIONES PRIVADAS
 * ============================================================================
 */

/**
 * Construye un objeto de log entry normalizado
 * @private
 */
function buildLogEntry(params) {
    const requestId = getCorrelationId();
    const now = new Date().toISOString();
    
    // Extraer datos del request si está disponible
    let ip = params.actorIp;
    let userAgent = params.userAgent;
    let sessionId = params.sessionId;
    
    if (params.req) {
        ip = ip || extractIp(params.req);
        userAgent = userAgent || params.req.headers['user-agent'];
        sessionId = sessionId || params.req.headers['x-session-id'];
    }
    
    // Sanitizar valores
    const oldValues = params.oldValues ? sanitizeValues(params.oldValues) : null;
    const newValues = params.newValues ? sanitizeValues(params.newValues) : null;
    
    return {
        action_type: params.action,
        action_description: params.description || null,
        actor_type: params.actorType,
        actor_id: params.actorId,
        actor_role: params.actorRole || null,
        actor_alias: params.actorAlias || null,
        actor_ip: ip || null,
        actor_user_agent: userAgent ? truncateString(userAgent, 500) : null,
        target_type: params.targetType || null,
        target_id: params.targetId || null,
        target_title: params.targetTitle || null,
        target_owner_id: params.targetOwnerId || null,
        request_id: requestId !== 'NO_CONTEXT' ? requestId : null,
        session_id: sessionId || null,
        old_values: oldValues,
        new_values: newValues,
        changed_fields: params.changedFields || null,
        metadata: params.metadata ? sanitizeValues(params.metadata) : null,
        success: params.success !== false, // default true
        error_code: params.errorCode || null,
        error_message: params.errorMessage ? truncateString(params.errorMessage, 1000) : null,
        created_at: now
    };
}

/**
 * Inserta un batch de logs en la base de datos
 * @private
 */
async function insertBatchLogs(logs) {
    if (logs.length === 0) return;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Activar contexto de RLS para sistema
        await client.query("SET LOCAL app.audit_system = 'true'");
        
        // Construir query de inserción masiva
        const values = [];
        const placeholders = [];
        let paramIndex = 1;
        
        for (const log of logs) {
            const keys = Object.keys(log).filter(k => log[k] !== undefined);
            const logPlaceholders = keys.map(() => `$${paramIndex++}`).join(', ');
            
            placeholders.push(`(${logPlaceholders})`);
            values.push(...keys.map(k => log[k]));
        }
        
        // Usar los keys del primer log (todos tienen la misma estructura)
        const firstLogKeys = Object.keys(logs[0]).filter(k => logs[0][k] !== undefined);
        const columns = firstLogKeys.join(', ');
        
        const query = `
            INSERT INTO audit_logs (${columns})
            VALUES ${placeholders.join(', ')}
        `;
        
        await client.query(query, values);
        await client.query('COMMIT');
        
        // Emitir eventos SSE (non-blocking)
        emitAuditLogEvents(logs);
        
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Inserta un único log (para operaciones síncronas)
 * @private
 */
async function insertSingleLog(logEntry) {
    const client = await pool.connect();
    try {
        await client.query("SET LOCAL app.audit_system = 'true'");
        
        const keys = Object.keys(logEntry).filter(k => logEntry[k] !== undefined);
        const columns = keys.join(', ');
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const values = keys.map(k => logEntry[k]);
        
        await client.query(
            `INSERT INTO audit_logs (${columns}) VALUES (${placeholders})`,
            values
        );
        
        // Emitir evento SSE (non-blocking)
        emitAuditLogEvents([logEntry]);
        
    } finally {
        client.release();
    }
}

/**
 * Programa el flush automático
 * @private
 */
function scheduleFlush() {
    if (flushTimer) return;
    
    flushTimer = setTimeout(async () => {
        flushTimer = null;
        await flushAuditLogs();
    }, BATCH_CONFIG.flushIntervalMs);
}

/**
 * Sanitiza valores para remover PII y datos sensibles
 * @private
 */
function sanitizeValues(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
        // Verificar si es campo sensible
        const isSensitive = SENSITIVE_FIELDS.some(sf => 
            key.toLowerCase().includes(sf.toLowerCase())
        );
        
        if (isSensitive) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeValues(value);
        } else {
            sanitized[key] = value;
        }
    }
    
    return sanitized;
}

/**
 * Extrae IP del request
 * @private
 */
function extractIp(req) {
    // Priorizar headers de proxy reverso (Render, Nginx, etc.)
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.ip ||
           req.connection?.remoteAddress;
}

/**
 * Trunca string a longitud máxima
 * @private
 */
function truncateString(str, maxLength) {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
}

/**
 * Fallback cuando la DB falla - escribe a stderr/log
 * @private
 */
function fallbackLog(logEntry, error) {
    try {
        const fallbackEntry = {
            _fallback: true,
            _fallbackReason: error?.message,
            timestamp: new Date().toISOString(),
            ...logEntry
        };
        
        // Escribir a stderr para captura por sistema de logs externo
        console.error('[AUDIT_FALLBACK]', JSON.stringify(fallbackEntry));
    } catch (e) {
        // Último recurso
        console.error('[AUDIT_FALLBACK_CRITICAL] Failed to write fallback log');
    }
}

/**
 * Sanitiza parámetros para logging de errores (evita circular references)
 * @private
 */
function sanitizeForLog(params) {
    const safe = { ...params };
    // Remover objetos grandes/complejos
    delete safe.req;
    delete safe.oldValues;
    delete safe.newValues;
    return safe;
}

/**
 * Emite eventos SSE para logs de auditoría (non-blocking)
 * @private
 */
function emitAuditLogEvents(logs) {
    try {
        // Importar eventEmitter dinámicamente para evitar circular deps
        import('../utils/eventEmitter.js').then(({ realtimeEvents }) => {
            for (const log of logs) {
                realtimeEvents.emit('audit-log', log);
            }
        }).catch(() => {
            // Silenciar errores de importación
        });
    } catch (e) {
        // Silenciar errores de emisión
    }
}

/**
 * ============================================================================
 * GRACEFUL SHUTDOWN
 * ============================================================================
 */
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, flushing pending audit logs...');
    await flushAuditLogs();
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, flushing pending audit logs...');
    await flushAuditLogs();
});

/**
 * ============================================================================
 * EXPORTS
 * ============================================================================
 */
export default {
    auditLog,
    auditLogSync,
    flushAuditLogs,
    queryAuditLogs,
    getUserActivitySummary,
    ActorType,
    AuditAction
};
