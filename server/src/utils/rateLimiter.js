import pool from '../config/database.js';
import rateLimit from 'express-rate-limit';

/**
 * Traditional memory-based rate limiter for general API protection
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Demasiadas peticiones desde esta IP, por favor intenta más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Database-backed rate limiter (Option A)
 * Resilient to server restarts and tracks by anonymous_id + action.
 * Supports multiple time windows (minute, hour).
 */
export const dbRateLimiter = ({ action, limitMinute, limitHour, message }) => {
  return async (req, res, next) => {
    // Priority: Anonymous ID from header -> IP address
    const anonymousId = req.headers['x-anonymous-id'] || req.ip;
    const key = `${action}:${anonymousId}`;
    const now = new Date();

    try {
      // 1. Atomic upsert logic to handle request tracking
      // We use a single query for efficiency
      const query = `
        INSERT INTO rate_limits (key, hits_minute, hits_hour, reset_minute, reset_hour)
        VALUES ($1, 1, 1, $2, $3)
        ON CONFLICT (key) DO UPDATE SET
          hits_minute = CASE WHEN rate_limits.reset_minute < $4 THEN 1 ELSE rate_limits.hits_minute + 1 END,
          hits_hour = CASE WHEN rate_limits.reset_hour < $4 THEN 1 ELSE rate_limits.hits_hour + 1 END,
          reset_minute = CASE WHEN rate_limits.reset_minute < $4 THEN $2 ELSE rate_limits.reset_minute END,
          reset_hour = CASE WHEN rate_limits.reset_hour < $4 THEN $3 ELSE rate_limits.reset_hour END,
          updated_at = NOW()
        RETURNING hits_minute, hits_hour, reset_minute, reset_hour;
      `;

      const resetMinute = new Date(now.getTime() + 60 * 1000);
      const resetHour = new Date(now.getTime() + 60 * 60 * 1000);

      const { rows } = await pool.query(query, [key, resetMinute, resetHour, now]);
      const state = rows[0];

      // 2. Enforce limits based on the updated state
      // If the current request (already incremented) exceeds the limit, block it.
      if (state.hits_minute > limitMinute || state.hits_hour > limitHour) {
        return res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: message || 'Estás realizando esta acción demasiado rápido. Por favor, espera.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: state.hits_minute > limitMinute ? state.reset_minute : state.reset_hour
        });
      }

      next();
    } catch (error) {
      console.error(`[RateLimit] Error checking ${key}:`, error);
      // Fallback: If DB fails, allow the request so we don't break the app
      next();
    }
  };
};

/**
 * Pre-configured granular limiters
 */

// Reports: 3 per minute, 10 per hour
export const createReportLimiter = dbRateLimiter({
  action: 'create_report',
  limitMinute: 3,
  limitHour: 10,
  message: 'Has alcanzado el límite de reportes permitidos. Intenta de nuevo en unos minutos.'
});

// Comments: 10 per minute, 50 per hour
export const createCommentLimiter = dbRateLimiter({
  action: 'create_comment',
  limitMinute: 10,
  limitHour: 50,
  message: 'Estás enviando demasiados comentarios. Por favor, espera un momento.'
});

// Flags: 5 per minute (Legacy memory-based fallback or reuse DB)
export const flagRateLimiter = dbRateLimiter({
  action: 'flag',
  limitMinute: 5,
  limitHour: 20,
  message: 'Has excedido el límite de denuncias permitidas.'
});

// ============================================
// NEW RATE LIMITERS FOR COMPLETE COVERAGE
// ============================================

// Votes: 30 per minute, 200 per hour (high frequency action)
export const voteLimiter = dbRateLimiter({
  action: 'vote',
  limitMinute: 30,
  limitHour: 200,
  message: 'Estás votando demasiado rápido. Por favor, espera un momento.'
});

// Favorites: 20 per minute, 100 per hour
export const favoriteLimiter = dbRateLimiter({
  action: 'favorite',
  limitMinute: 20,
  limitHour: 100,
  message: 'Has alcanzado el límite de favoritos. Intenta en unos minutos.'
});

// Image uploads: 5 per minute, 20 per hour (expensive operation - storage costs)
export const imageUploadLimiter = dbRateLimiter({
  action: 'image_upload',
  limitMinute: 5,
  limitHour: 20,
  message: 'Has subido demasiadas imágenes. Por favor, intenta más tarde.'
});

// Comment likes: 30 per minute, 200 per hour
export const likeLimiter = dbRateLimiter({
  action: 'like',
  limitMinute: 30,
  limitHour: 200,
  message: 'Estás dando likes demasiado rápido. Espera un momento.'
});

