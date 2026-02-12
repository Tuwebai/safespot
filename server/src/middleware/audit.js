/**
 * ============================================================================
 * AUDIT MIDDLEWARE - ENTERPRISE GRADE
 * ============================================================================
 * 
 * Middleware de Express para capturar automáticamente acciones auditables.
 * Se integra con el AuditService para registro inmutable.
 * 
 * Características:
 * - Captura automática de cambios (old vs new values)
 * - Detección de campos modificados
 * - Integración transparente con rutas existentes
 * - Soporte para operaciones síncronas y asíncronas
 * 
 * @module middleware/audit
 */

import { auditLog, auditLogSync, ActorType, AuditAction } from '../services/auditService.js';

/**
 * ============================================================================
 * MIDDLEWARES DE AUDITORÍA
 * ============================================================================
 */

/**
 * Middleware factory: Crea un middleware de auditoría para una acción específica
 * 
 * @param {Object} config - Configuración del middleware
 * @param {AuditAction} config.action - Tipo de acción a auditar
 * @param {string} config.targetType - Tipo de recurso (report, comment, etc.)
 * @param {Function} [config.getTargetId] - Función para extraer target ID del req
 * @param {Function} [config.getActorId] - Función para extraer actor ID del req
 * @param {Function} [config.getMetadata] - Función para extraer metadata adicional
 * @param {boolean} [config.sync=false] - Si debe ser síncrono (crítico)
 * @param {boolean} [config.captureResponse=false] - Si debe capturar respuesta
 * @returns {Function} Middleware de Express
 * 
 * @example
 * router.post('/reports', 
 *   auditMiddleware({
 *     action: AuditAction.REPORT_CREATE,
 *     targetType: 'report',
 *     getTargetId: (req, res) => res.locals.createdReport?.id,
 *     getMetadata: (req) => ({ imageCount: req.files?.length })
 *   }),
 *   createReportHandler
 * );
 */
export function auditMiddleware(config) {
    return async (req, res, next) => {
        const startTime = Date.now();
        
        // Capturar datos antes de la operación (para comparación)
        const oldValues = config.captureOldValues ? await config.captureOldValues(req) : null;
        
        // Hook para capturar respuesta
        if (config.captureResponse) {
            const originalJson = res.json.bind(res);
            
            res.json = function(body) {
                // Restaurar método original
                res.json = originalJson;
                
                // Ejecutar auditoría con datos de respuesta
                executeAudit(req, res, config, oldValues, body, startTime);
                
                // Continuar con respuesta original
                return originalJson(body);
            };
        }
        
        // Hook para capturar cuando la respuesta termina
        res.on('finish', () => {
            // Solo auditar si no capturamos respuesta (evitar duplicados)
            if (!config.captureResponse) {
                executeAudit(req, res, config, oldValues, null, startTime);
            }
        });
        
        next();
    };
}

/**
 * Middleware simplificado para acciones CRUD comunes
 * Captura automáticamente métodos HTTP y parámetros
 */
export function auditCrud(options) {
    const { resource, actions = {} } = options;
    
    return async (req, res, next) => {
        const method = req.method;
        const actionMap = {
            'POST': actions.create || `${resource}_create`,
            'PUT': actions.update || `${resource}_update`,
            'PATCH': actions.update || `${resource}_update`,
            'DELETE': actions.delete || `${resource}_delete`
        };
        
        const action = actionMap[method];
        if (!action) {
            return next(); // No auditar métodos no mapeados
        }
        
        // Capturar estado anterior para UPDATE/DELETE
        let oldValues = null;
        if (method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
            oldValues = await captureCurrentState(req, resource);
        }
        
        // Hook en respuesta
        res.on('finish', async () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const targetId = req.params.id || res.locals.resourceId;
                
                await auditLog({
                    action,
                    actorType: getActorType(req),
                    actorId: getActorId(req),
                    actorRole: getActorRole(req),
                    req,
                    targetType: resource,
                    targetId,
                    oldValues: method !== 'POST' ? oldValues : null,
                    newValues: method !== 'DELETE' ? sanitizeBody(req.body) : null,
                    success: true
                });
            }
        });
        
        next();
    };
}

/**
 * Middleware específico para acciones de moderación
 * Captura contexto adicional de moderación
 */
export function auditModeration(action, options = {}) {
    return async (req, res, next) => {
        const { targetType, getTargetOwner } = options;
        
        res.on('finish', async () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const targetId = req.params.id;
                const targetOwnerId = getTargetOwner ? await getTargetOwner(targetId) : null;
                
                await auditLog({
                    action,
                    description: options.description || `Moderation: ${action}`,
                    actorType: ActorType.ADMIN,
                    actorId: req.adminUser?.id || req.adminUser?.admin_id,
                    actorRole: req.adminUser?.role,
                    req,
                    targetType,
                    targetId,
                    targetOwnerId,
                    metadata: {
                        reason: req.body.reason,
                        internalNote: req.body.internal_note,
                        banUser: req.body.banUser,
                        previousStatus: req.body.previousStatus
                    },
                    success: true
                });
            }
        });
        
        next();
    };
}

/**
 * Middleware para auditoría de autenticación
 * Registra login/logout/failed attempts
 */
export function auditAuth(action, options = {}) {
    return async (req, res, next) => {
        const startTime = Date.now();
        
        res.on('finish', async () => {
            const success = res.statusCode >= 200 && res.statusCode < 300;
            
            await auditLog({
                action,
                actorType: options.actorType || ActorType.ANONYMOUS,
                actorId: getActorId(req) || req.body?.anonymous_id || 'unknown',
                actorRole: getActorRole(req),
                req,
                metadata: {
                    method: req.body?.method || 'standard',
                    provider: req.body?.provider,
                    duration: Date.now() - startTime,
                    userAgent: req.headers['user-agent']
                },
                success,
                errorCode: !success ? getErrorCode(res.statusCode) : null,
                errorMessage: !success ? getErrorMessage(res) : null
            });
        });
        
        next();
    };
}

/**
 * ============================================================================
 * HELPERS
 * ============================================================================
 */

/**
 * Ejecuta el registro de auditoría
 * @private
 */
async function executeAudit(req, res, config, oldValues, responseBody, startTime) {
    try {
        const success = res.statusCode >= 200 && res.statusCode < 300;
        
        // Extraer target ID
        let targetId = null;
        if (config.getTargetId) {
            targetId = config.getTargetId(req, res, responseBody);
        } else if (req.params.id) {
            targetId = req.params.id;
        } else if (responseBody?.id) {
            targetId = responseBody.id;
        } else if (responseBody?.data?.id) {
            targetId = responseBody.data.id;
        }
        
        // Extraer actor
        const actorType = config.getActorType ? config.getActorType(req) : getActorType(req);
        const actorId = config.getActorId ? config.getActorId(req) : getActorId(req);
        const actorRole = config.getActorRole ? config.getActorRole(req) : getActorRole(req);
        
        // Construir valores nuevos
        let newValues = null;
        if (config.getNewValues) {
            newValues = config.getNewValues(req, res, responseBody);
        } else if (config.captureResponse && responseBody) {
            newValues = extractValuesFromResponse(responseBody);
        }
        
        // Detectar campos cambiados
        const changedFields = oldValues && newValues 
            ? detectChangedFields(oldValues, newValues)
            : null;
        
        // Metadata adicional
        let metadata = null;
        if (config.getMetadata) {
            metadata = config.getMetadata(req, res, responseBody);
        }
        
        // Agregar timing
        metadata = {
            ...metadata,
            _audit: {
                responseTime: Date.now() - startTime,
                statusCode: res.statusCode
            }
        };
        
        const auditParams = {
            action: config.action,
            description: config.description,
            actorType,
            actorId,
            actorRole,
            req,
            targetType: config.targetType,
            targetId,
            targetOwnerId: config.getTargetOwnerId ? await config.getTargetOwnerId(targetId) : null,
            oldValues,
            newValues,
            changedFields,
            metadata,
            success,
            errorCode: !success ? getErrorCode(res.statusCode) : null,
            errorMessage: !success ? getErrorMessage(res) : null
        };
        
        if (config.sync) {
            await auditLogSync(auditParams);
        } else {
            await auditLog(auditParams);
        }
    } catch (error) {
        // No debe afectar el flujo principal
        console.error('Audit middleware error:', error);
    }
}

/**
 * Determina el tipo de actor desde el request
 * @private
 */
function getActorType(req) {
    if (req.adminUser) return ActorType.ADMIN;
    if (req.user) return ActorType.ANONYMOUS;
    return ActorType.ANONYMOUS;
}

/**
 * Extrae el ID del actor desde el request
 * @private
 */
function getActorId(req) {
    // Admin tiene prioridad
    if (req.adminUser?.id) return req.adminUser.id;
    if (req.adminUser?.admin_id) return req.adminUser.admin_id;
    
    // Usuario anónimo
    if (req.user?.anonymous_id) return req.user.anonymous_id;
    if (req.user?.id) return req.user.id;
    if (req.headers['x-anonymous-id']) return req.headers['x-anonymous-id'];
    
    return 'unknown';
}

/**
 * Extrae el rol del actor
 * @private
 */
function getActorRole(req) {
    if (req.adminUser?.role) return req.adminUser.role;
    if (req.user?.role) return req.user.role;
    return 'citizen';
}

/**
 * Captura estado actual de un recurso
 * @private
 */
async function captureCurrentState(req, resource) {
    // Implementación básica - puede ser extendida
    // En producción, esto haría queries a la DB
    return null;
}

/**
 * Sanitiza el body de la request para auditoría
 * @private
 */
function sanitizeBody(body) {
    if (!body || typeof body !== 'object') return body;
    
    const sensitiveFields = ['password', 'token', 'secret', 'api_key'];
    const sanitized = {};
    
    for (const [key, value] of Object.entries(body)) {
        if (sensitiveFields.some(sf => key.toLowerCase().includes(sf))) {
            sanitized[key] = '[REDACTED]';
        } else {
            sanitized[key] = value;
        }
    }
    
    return sanitized;
}

/**
 * Extrae valores relevantes de la respuesta
 * @private
 */
function extractValuesFromResponse(body) {
    if (!body) return null;
    
    // Si tiene data, usar eso
    const data = body.data || body;
    
    // Extraer campos comunes
    const fields = ['id', 'title', 'content', 'status', 'category', 'zone', 'anonymous_id'];
    const values = {};
    
    for (const field of fields) {
        if (data[field] !== undefined) {
            values[field] = data[field];
        }
    }
    
    return Object.keys(values).length > 0 ? values : null;
}

/**
 * Detecta campos que cambiaron entre old y new
 * @private
 */
function detectChangedFields(oldValues, newValues) {
    const changed = [];
    
    for (const key of Object.keys(newValues)) {
        if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
            changed.push(key);
        }
    }
    
    return changed.length > 0 ? changed : null;
}

/**
 * Obtiene código de error basado en status HTTP
 * @private
 */
function getErrorCode(statusCode) {
    const codes = {
        400: 'BAD_REQUEST',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        409: 'CONFLICT',
        422: 'VALIDATION_ERROR',
        429: 'RATE_LIMITED',
        500: 'INTERNAL_ERROR',
        502: 'BAD_GATEWAY',
        503: 'SERVICE_UNAVAILABLE'
    };
    return codes[statusCode] || `HTTP_${statusCode}`;
}

/**
 * Obtiene mensaje de error de la respuesta
 * @private
 */
function getErrorMessage(res) {
    // En una implementación real, esto capturaría el mensaje de error
    return null;
}

/**
 * ============================================================================
 * EXPORTS
 * ============================================================================
 */
export default {
    auditMiddleware,
    auditCrud,
    auditModeration,
    auditAuth
};
