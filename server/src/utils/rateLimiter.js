import rateLimit from 'express-rate-limit';
import redis from '../config/redis.js';

/**
 * Traditional memory-based rate limiter for general API protection
 * Used as a fallback or for global IP protection.
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
 * Redis-backed rate limiter
 * Replaces the PostgreSQL implementation for high-speed, low-latency limiting.
 * Requires: redis client from ../config/redis.js
 */
export const dbRateLimiter = ({ action, limitMinute, limitHour, message }) => {
  return async (req, res, next) => {
    // If Redis is not connected, fallback to allow (or memory limit if critical)
    // For now, we allowTraffic to avoid blocking users on infra failure.
    if (!redis || redis.status !== 'ready') {
      // console.warn('[RateLimit] Redis not ready, bypassing limit for', action);
      return next();
    }

    const anonymousId = req.headers['x-anonymous-id'] || req.ip;
    const keyBase = `rate:${action}:${anonymousId}`;
    const keyMin = `${keyBase}:min`;
    const keyHour = `${keyBase}:hour`;

    try {
      // Pipeline for atomicity and speed (1 round trip)
      const pipeline = redis.pipeline();

      // Minute Counter
      pipeline.incr(keyMin);
      pipeline.ttl(keyMin);

      // Hour Counter
      pipeline.incr(keyHour);
      pipeline.ttl(keyHour);

      const results = await pipeline.exec();

      // Parse results: [[err, incrVal], [err, ttlVal], ...]
      const hitsMinute = results[0][1];
      const ttlMinute = results[1][1];
      const hitsHour = results[2][1];
      const ttlHour = results[3][1];

      // Set TTL if new key (TTL == -1)
      if (ttlMinute === -1) {
        redis.expire(keyMin, 60); // 1 minute
      }
      if (ttlHour === -1) {
        redis.expire(keyHour, 3600); // 1 hour
      }

      // Add Headers for Observability
      res.setHeader('X-RateLimit-Limit-Minute', limitMinute);
      res.setHeader('X-RateLimit-Remaining-Minute', Math.max(0, limitMinute - hitsMinute));
      res.setHeader('X-RateLimit-Limit-Hour', limitHour);
      res.setHeader('X-RateLimit-Remaining-Hour', Math.max(0, limitHour - hitsHour));

      // Check Limits
      if (hitsMinute > limitMinute) {
        return res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: message || 'Estás realizando esta acción demasiado rápido. Espere un momento.',
          retryAfter: 60 // Simple retry suggestion
        });
      }

      if (hitsHour > limitHour) {
        return res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: message || 'Límite por hora excedido. Intente más tarde.',
          retryAfter: 3600
        });
      }

      next();
    } catch (error) {
      console.error(`[RateLimit] Redis error for ${keyBase}:`, error);
      // Fail open: Allow request if Redis errors
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

// Flags: 5 per minute
export const flagRateLimiter = dbRateLimiter({
  action: 'flag',
  limitMinute: 5,
  limitHour: 20,
  message: 'Has excedido el límite de denuncias permitidas.'
});

// Votes: 30 per minute, 200 per hour
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

// Image uploads: 5 per minute, 20 per hour
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

// Admin Login: 5 attempts per 15 minutes (Strict)
export const loginLimiter = dbRateLimiter({
  action: 'admin_login',
  limitMinute: 5,
  limitHour: 20,
  message: 'Demasiados intentos de inicio de sesión. Cuenta bloqueada temporalmente.'
});

// User Auth (Login/Register): 10 per minute, 50 per hour
export const authLimiter = dbRateLimiter({
  action: 'user_auth',
  limitMinute: 10,
  limitHour: 50,
  message: 'Demasiados intentos de autenticación. Por favor, espera un momento.'
});
