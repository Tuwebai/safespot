/**
 * 🔒 Identity Unification Middleware
 * 
 * FUENTE ÚNICA DE VERDAD para identidad de usuario.
 * Prohibe lectura directa de req.headers['x-anonymous-id'] en handlers.
 * 
 * Invariante: Si req.user.anonymous_id existe (seteado por validateAuth JWT),
 * ese es el único ID válido. Nunca leer del header directamente.
 */

import { logError } from '../utils/logger.js';

/**
 * Middleware: requireUser
 * Asegura que el usuario esté autenticado y expone req.userId
 */
export function requireUser(req, res, next) {
  const userId = req.user?.anonymous_id;
  
  if (!userId) {
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'AUTH_REQUIRED',
      message: 'Se requiere autenticación para acceder a este recurso'
    });
  }

  // 🔒 FUENTE ÚNICA DE VERDAD
  req.userId = userId;
  
  // Log para debugging (solo en desarrollo)
  if (process.env.DEBUG && process.env.NODE_ENV !== 'production') {
    console.debug(`[Identity] Request authenticated: ${userId.substring(0, 8)}...`);
  }
  
  next();
}

/**
 * Middleware: requireUserOrAnonymous
 * Para endpoints que aceptan usuarios anónimos (no autenticados)
 * pero aún necesitan un ID para tracking/rate limiting.
 */
export function requireUserOrAnonymous(req, res, next) {
  // Prioridad: JWT validado > header firmado (legacy) > null
  const userId = req.user?.anonymous_id || req.headers['x-anonymous-id'];
  
  if (!userId) {
    return res.status(400).json({
      error: 'Bad Request',
      code: 'ANONYMOUS_ID_REQUIRED',
      message: 'X-Anonymous-Id header is required'
    });
  }

  req.userId = userId;
  next();
}

/**
 * Helper: getUserId (para uso en código legacy durante transición)
 * @deprecated Usar req.userId directamente
 */
export function getUserId(req) {
  // 🚨 ADVERTENCIA: Esta función solo debe usarse durante la transición
  // El objetivo es eliminar todas las llamadas a esta función y usar req.userId
  
  if (req.userId) {
    return req.userId;
  }
  
  // Fallback a legacy (con warning)
  const legacyId = req.user?.anonymous_id || req.headers['x-anonymous-id'];
  
  if (legacyId && process.env.NODE_ENV !== 'production') {
    console.warn(`[Identity] ⚠️ LEGACY FALLBACK USED: getUserId() called without req.userId set. Path: ${req.originalUrl}`);
    
    // Stack trace para encontrar el código legacy
    const stack = new Error().stack?.split('\n').slice(2, 4).join(' \n');
    console.warn(`[Identity] Stack: ${stack}`);
  }
  
  return legacyId;
}

/**
 * Middleware: auditIdentityAccess
 * Para debugging: logea cada acceso a identidad (desarrollo only)
 */
export function auditIdentityAccess(req, res, next) {
  const headerId = req.headers['x-anonymous-id'];
  const jwtId = req.user?.anonymous_id;
  
  if (headerId && jwtId && headerId !== jwtId) {
    // 🚨 MISMATCH DETECTADO - potencial intento de spoofing
    logError(new Error('Identity Mismatch Detected'), {
      context: 'IdentityAudit',
      headerId: headerId.substring(0, 8) + '...',
      jwtId: jwtId.substring(0, 8) + '...',
      path: req.originalUrl,
      ip: req.ip
    });
  }
  
  next();
}
