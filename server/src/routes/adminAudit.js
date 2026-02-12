/**
 * ============================================================================
 * ADMIN AUDIT ROUTES - ENTERPRISE GRADE
 * ============================================================================
 * 
 * Endpoints para consulta y gestión de logs de auditoría.
 * Solo accesible por admins con permisos apropiados.
 * 
 * @module routes/adminAudit
 */

import express from 'express';
import { verifyAdminToken } from '../utils/adminMiddleware.js';
import { queryAuditLogs, getUserActivitySummary, AuditAction } from '../services/auditService.js';
import pool from '../config/database.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * ============================================================================
 * MIDDLEWARE DE AUTORIZACIÓN
 * ============================================================================
 */

/**
 * Verifica que el admin tenga permisos para ver auditoría
 * Solo super_admins y admins con rol específico pueden acceder
 */
const requireAuditAccess = (req, res, next) => {
    const { role } = req.adminUser || {};
    
    if (role !== 'super_admin' && role !== 'admin') {
        return res.status(403).json({
            error: 'Acceso denegado',
            message: 'Se requieren permisos de administrador para acceder a auditoría'
        });
    }
    
    next();
};

/**
 * ============================================================================
 * RUTAS
 * ============================================================================
 */

/**
 * GET /api/admin/audit/logs
 * 
 * Obtiene logs de auditoría con filtros avanzados
 * 
 * Query params:
 * - actorId: Filtrar por ID de actor
 * - targetId: Filtrar por ID de recurso afectado
 * - action: Tipo de acción (ver enum AuditAction)
 * - actorType: 'anonymous' | 'admin' | 'system'
 * - startDate: Fecha inicio (ISO 8601)
 * - endDate: Fecha fin (ISO 8601)
 * - success: 'true' | 'false' - Filtrar por éxito/fracaso
 * - limit: Número de resultados (default: 50, max: 100)
 * - offset: Offset para paginación (default: 0)
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     logs: [...],
 *     total: number,
 *     pagination: { limit, offset, hasMore }
 *   }
 * }
 */
router.get('/logs', verifyAdminToken, requireAuditAccess, async (req, res) => {
    try {
        const {
            actorId,
            targetId,
            action,
            actorType,
            startDate,
            endDate,
            success,
            limit = 50,
            offset = 0
        } = req.query;
        
        // Validar action si se proporciona
        if (action && !Object.values(AuditAction).includes(action)) {
            return res.status(400).json({
                error: 'Parámetro inválido',
                message: `Action '${action}' no es válida`,
                validActions: Object.values(AuditAction)
            });
        }
        
        // Parsear fechas
        const parsedStartDate = startDate ? new Date(startDate) : null;
        const parsedEndDate = endDate ? new Date(endDate) : null;
        
        if (startDate && isNaN(parsedStartDate.getTime())) {
            return res.status(400).json({
                error: 'Parámetro inválido',
                message: 'startDate debe ser una fecha válida (ISO 8601)'
            });
        }
        
        if (endDate && isNaN(parsedEndDate.getTime())) {
            return res.status(400).json({
                error: 'Parámetro inválido',
                message: 'endDate debe ser una fecha válida (ISO 8601)'
            });
        }
        
        // Construir filtros
        const filters = {
            actorId,
            targetId,
            action,
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 50)),
            offset: Math.max(0, parseInt(offset, 10) || 0)
        };
        
        // Ejecutar query
        const result = await queryAuditLogs(filters);
        
        res.json({
            success: true,
            data: {
                logs: result.logs,
                total: result.total,
                pagination: {
                    limit: filters.limit,
                    offset: filters.offset,
                    hasMore: filters.offset + result.logs.length < result.total
                }
            },
            meta: {
                query: req.query,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        logger.error('Error querying audit logs', { error: error.message, query: req.query });
        res.status(500).json({
            error: 'Error interno',
            message: 'No se pudieron obtener los logs de auditoría'
        });
    }
});

/**
 * GET /api/admin/audit/logs/:id
 * 
 * Obtiene un log específico por ID
 */
router.get('/logs/:id', verifyAdminToken, requireAuditAccess, async (req, res) => {
    try {
        const { id } = req.params;
        
        const client = await pool.connect();
        try {
            // Activar contexto de admin para RLS
            await client.query("SET LOCAL app.is_admin = 'true'");
            
            const result = await client.query(
                `SELECT * FROM audit_logs WHERE id = $1`,
                [id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: 'No encontrado',
                    message: 'Log de auditoría no existe'
                });
            }
            
            res.json({
                success: true,
                data: result.rows[0]
            });
            
        } finally {
            client.release();
        }
        
    } catch (error) {
        logger.error('Error fetching audit log', { error: error.message, logId: req.params.id });
        res.status(500).json({
            error: 'Error interno',
            message: 'No se pudo obtener el log de auditoría'
        });
    }
});

/**
 * GET /api/admin/audit/user/:userId/summary
 * 
 * Obtiene resumen de actividad de un usuario específico
 * Útil para investigaciones y transparencia
 */
router.get('/user/:userId/summary', verifyAdminToken, requireAuditAccess, async (req, res) => {
    try {
        const { userId } = req.params;
        const { startDate, endDate } = req.query;
        
        // Defaults: últimos 30 días
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate 
            ? new Date(startDate) 
            : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const summary = await getUserActivitySummary(userId, start, end);
        
        res.json({
            success: true,
            data: {
                userId,
                period: { start, end },
                summary
            }
        });
        
    } catch (error) {
        logger.error('Error fetching user audit summary', { 
            error: error.message, 
            userId: req.params.userId 
        });
        res.status(500).json({
            error: 'Error interno',
            message: 'No se pudo obtener el resumen de actividad'
        });
    }
});

/**
 * GET /api/admin/audit/user/:userId/timeline
 * 
 * Obtiene timeline cronológico de actividad de un usuario
 * Incluye acciones realizadas POR el usuario y acciones realizadas SOBRE el usuario
 */
router.get('/user/:userId/timeline', verifyAdminToken, requireAuditAccess, async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        
        const client = await pool.connect();
        try {
            await client.query("SET LOCAL app.is_admin = 'true'");
            
            // Buscar acciones POR el usuario y SOBRE el usuario
            const result = await client.query(
                `SELECT 
                    al.*,
                    CASE 
                        WHEN al.actor_id = $1 THEN 'by_user'
                        ELSE 'on_user'
                    END as relationship
                FROM audit_logs al
                WHERE (al.actor_id = $1 OR al.target_owner_id = $1)
                ORDER BY al.created_at DESC
                LIMIT $2 OFFSET $3`,
                [userId, Math.min(100, parseInt(limit, 10)), Math.max(0, parseInt(offset, 10))]
            );
            
            res.json({
                success: true,
                data: {
                    userId,
                    timeline: result.rows
                }
            });
            
        } finally {
            client.release();
        }
        
    } catch (error) {
        logger.error('Error fetching user timeline', { error: error.message, userId: req.params.userId });
        res.status(500).json({
            error: 'Error interno',
            message: 'No se pudo obtener el timeline'
        });
    }
});

/**
 * GET /api/admin/audit/stats/overview
 * 
 * Estadísticas generales de auditoría
 * Dashboard overview
 */
router.get('/stats/overview', verifyAdminToken, requireAuditAccess, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate 
            ? new Date(startDate) 
            : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000); // Últimos 7 días
        
        const client = await pool.connect();
        try {
            await client.query("SET LOCAL app.is_admin = 'true'");
            
            // Estadísticas agregadas
            const statsResult = await client.query(
                `SELECT 
                    action_type,
                    COUNT(*) as count,
                    COUNT(CASE WHEN success THEN 1 END) as success_count,
                    COUNT(CASE WHEN NOT success THEN 1 END) as error_count
                FROM audit_logs
                WHERE created_at BETWEEN $1 AND $2
                GROUP BY action_type
                ORDER BY count DESC`,
                [start, end]
            );
            
            // Actividad por día
            const dailyResult = await client.query(
                `SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as total_actions
                FROM audit_logs
                WHERE created_at BETWEEN $1 AND $2
                GROUP BY DATE(created_at)
                ORDER BY date DESC`,
                [start, end]
            );
            
            // Top actores
            const topActorsResult = await client.query(
                `SELECT 
                    actor_type,
                    actor_id,
                    COUNT(*) as action_count
                FROM audit_logs
                WHERE created_at BETWEEN $1 AND $2
                GROUP BY actor_type, actor_id
                ORDER BY action_count DESC
                LIMIT 10`,
                [start, end]
            );
            
            res.json({
                success: true,
                data: {
                    period: { start, end },
                    stats: {
                        byAction: statsResult.rows,
                        daily: dailyResult.rows,
                        topActors: topActorsResult.rows
                    }
                }
            });
            
        } finally {
            client.release();
        }
        
    } catch (error) {
        logger.error('Error fetching audit stats', { error: error.message });
        res.status(500).json({
            error: 'Error interno',
            message: 'No se pudieron obtener las estadísticas'
        });
    }
});

/**
 * GET /api/admin/audit/actions
 * 
 * Lista de acciones auditables disponibles
 * Útil para construir filtros en UI
 */
router.get('/actions', verifyAdminToken, requireAuditAccess, (req, res) => {
    // Agrupar acciones por categoría
    const actionsByCategory = {
        reportes: [
            'report_create', 'report_update', 'report_delete', 'report_view',
            'report_flag', 'report_unflag', 'report_hide', 'report_unhide'
        ],
        comentarios: [
            'comment_create', 'comment_update', 'comment_delete',
            'comment_flag', 'comment_unflag', 'comment_hide', 'comment_unhide',
            'comment_pin', 'comment_unpin'
        ],
        votos: ['vote_create', 'vote_delete'],
        usuarios: [
            'user_register', 'user_update', 'user_delete', 'user_ban', 'user_unban',
            'user_shadow_ban', 'user_unshadow_ban', 'user_alias_change'
        ],
        auth: ['auth_login', 'auth_logout', 'auth_refresh', 'auth_failed'],
        moderacion: [
            'moderation_resolve', 'moderation_note_add', 'moderation_note_delete',
            'admin_login', 'admin_logout', 'admin_action'
        ],
        chat: ['chat_create', 'chat_message_send', 'chat_message_delete'],
        sistema: [
            'system_export', 'system_config_change', 'api_key_created', 'api_key_revoked'
        ]
    };
    
    res.json({
        success: true,
        data: {
            actions: Object.values(AuditAction),
            actionsByCategory,
            actorTypes: ['anonymous', 'admin', 'system']
        }
    });
});

/**
 * POST /api/admin/audit/cleanup
 * 
 * Ejecuta limpieza de logs antiguos según políticas de retención
 * SOLO super_admin
 */
router.post('/cleanup', verifyAdminToken, async (req, res) => {
    try {
        // Verificar super_admin
        if (req.adminUser?.role !== 'super_admin') {
            return res.status(403).json({
                error: 'Acceso denegado',
                message: 'Solo super_admin puede ejecutar limpieza'
            });
        }
        
        const client = await pool.connect();
        try {
            const result = await client.query('SELECT cleanup_audit_logs() as deleted_count');
            const deletedCount = result.rows[0].deleted_count;
            
            // Loggear la acción de cleanup
            logger.info('Audit log cleanup executed', { 
                deletedCount, 
                executedBy: req.adminUser.id 
            });
            
            res.json({
                success: true,
                data: {
                    deletedCount,
                    message: `Se eliminaron ${deletedCount} logs antiguos según políticas de retención`
                }
            });
            
        } finally {
            client.release();
        }
        
    } catch (error) {
        logger.error('Error during audit cleanup', { error: error.message });
        res.status(500).json({
            error: 'Error interno',
            message: 'No se pudo ejecutar la limpieza'
        });
    }
});

/**
 * GET /api/admin/audit/stream
 * 
 * SSE endpoint para logs de auditoría en tiempo real
 * Envía nuevos logs a los admins conectados
 */
router.get('/stream', verifyAdminToken, requireAuditAccess, async (req, res) => {
    try {
        // Headers SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        
        // Heartbeat cada 30s para mantener conexión
        const heartbeat = setInterval(() => {
            res.write('data: {"type":"heartbeat"}\n\n');
        }, 30000);
        
        // Enviar confirmación de conexión
        res.write('data: {"type":"connected","message":"Audit log stream active"}\n\n');
        
        // Importar eventEmitter dinámicamente
        const { realtimeEvents } = await import('../utils/eventEmitter.js');
        
        // Handler para nuevos logs
        const onAuditLog = (log) => {
            res.write(`data: ${JSON.stringify({ type: 'audit_log', data: log })}\n\n`);
        };
        
        // Suscribirse a eventos de audit
        realtimeEvents.on('audit-log', onAuditLog);
        
        // Cleanup al cerrar conexión
        req.on('close', () => {
            clearInterval(heartbeat);
            realtimeEvents.off('audit-log', onAuditLog);
            logger.debug('Admin disconnected from audit stream');
        });
        
    } catch (error) {
        logger.error('Audit stream error:', error);
        res.status(500).end();
    }
});

/**
 * ============================================================================
 * EXPORTS
 * ============================================================================
 */
export default router;
