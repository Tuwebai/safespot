import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { requestLogger } from './utils/logger.js';

// Router imports
import presenceRouter from './routes/presence.js';
import reportsRouter from './routes/reports.js';

// API Routes
import commentsRouter from './routes/comments.js';
import votesRouter from './routes/votes.js';
import usersRouter from './routes/users.js';
import authRouter from './routes/auth.js';
import { validateAuth } from './middleware/auth.js';
import favoritesRouter from './routes/favorites.js';
import badgesRouter from './routes/badges.js';
import gamificationRouter from './routes/gamification.js';
import userZonesRouter from './routes/userZones.js';
import testRouter from './routes/test.js';
import geocodeRouter from './routes/geocode.js';
import pushRouter from './routes/push.js';
import sitemapRouter from './routes/sitemap.js';
import seoRouter from './routes/seo.js';
import notificationsRouter from './routes/notifications.js';
import realtimeRouter from './routes/realtime.js';
import chatsRouter from './routes/chats.js';
import adminAuthRouter from './routes/adminAuth.js';
import adminStatsRouter from './routes/adminStats.js';
import adminHeatmapRouter from './routes/adminHeatmap.js';
import adminUsersRouter from './routes/adminUsers.js';
import adminModerationRouter from './routes/adminModeration.js';
import adminTasksRouter from './routes/adminTasks.js';
import contactRouter from './routes/contact.js';
import { logCriticalError } from './utils/adminTasks.js';
import { notifyError } from './utils/whatsapp.js';

// Load environment variables
// dotenv.config(); (Redundant, already called at top)

const app = express();

const PORT = process.env.PORT || 3000;

// ============================================
// ENVIRONMENT VALIDATION
// ============================================

const requiredEnvVars = ['DATABASE_URL'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ ERROR: Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}

// ============================================
// TRUST PROXY (Required for Render)
// ============================================

// Render uses a reverse proxy, so we need to trust the X-Forwarded-* headers
app.set('trust proxy', 1);

// 1. CORS - MUST be first for cross-origin SSE/API requests
const allowedOrigins = [
  'http://localhost:5174',
  'http://localhost:5173',
  'https://safespot.netlify.app',
  process.env.CORS_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Anonymous-Id', 'X-Client-ID', 'Cache-Control', 'Last-Event-ID', 'Authorization', 'Pragma', 'Expires']
}));

// 2. Real-time SSE (Must be before Helmet and Rate Limiters)
// These connections are long-lived and Helmet/RateLimits can cause resets
app.use('/api/realtime', realtimeRouter);

// 3. Security Middleware (Helmet)
// Helmet is applied AFTER realtime to avoid interfering with SSE headers
app.use(helmet());

// ============================================
// BODY PARSING WITH LIMITS
// ============================================

// Prevent DoS attacks with large payloads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// REQUEST LOGGING
// ============================================

app.use(requestLogger);

// ============================================
// AUTH MIDDLEWARE (Global)
// ============================================
// Must be before Rate Limiting (to potentially allow higher limits for auth users)
app.use(validateAuth);

// ============================================
// RATE LIMITING
// ============================================

// Base key generator that prioritizes anonymous_id
const keyGenerator = (req) => {
  return req.headers['x-anonymous-id'] || req.ip;
};

// Global limiter: 100 req / 5 min
const globalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  keyGenerator,
  message: {
    error: true,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Demasiadas peticiones. Por favor, intentá más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for sensitive actions (Reports/Comments): 5 req / 10 min
const actionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator,
  message: {
    error: true,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Has realizado demasiadas acciones en poco tiempo. Por favor, esperá unos minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all attempts (even failed ones) against the limit
});

// app.use('/api/realtime', realtimeRouter); // Moved up

// app.use('/api/', globalLimiter);
// Removed actionLimiter - too restrictive for normal usage
// app.use(['/api/reports', '/api/comments'], (req, res, next) => {
//   if (req.method === 'POST') {
//     return actionLimiter(req, res, next);
//   }
//   next();
// });

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'SafeSpot API',
    version: '1.0.0'
  });
});

// ============================================
// API ROUTES
// ============================================

// SEO Routes (Shadow SSR for bots)
app.use('/seo', seoRouter);

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/votes', votesRouter);
app.use('/api/users', usersRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/badges', badgesRouter);
app.use('/api/gamification', gamificationRouter);
app.use('/api/test', testRouter);
app.use('/api/geocode', geocodeRouter);
app.use('/api/push', pushRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/contact', contactRouter); // Register Contact Route
app.use('/api/presence', presenceRouter);
// app.use('/api/realtime', realtimeRouter); // Moved up to bypass rate limit
app.use('/api/admin/auth', adminAuthRouter);
app.use('/api/admin', adminStatsRouter); // Mount at /api/admin so it becomes /api/admin/stats
app.use('/api/admin', adminHeatmapRouter); // Mount at /api/admin so it becomes /api/admin/heatmap
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/admin/moderation', adminModerationRouter); // Mount at /api/admin/users
app.use('/api/admin/tasks', adminTasksRouter);
app.use('/api/user-zones', userZonesRouter);
app.use('/api/chats', chatsRouter);
app.use('/api', sitemapRouter);
app.use('/api/seo', seoRouter); // Also expose under /api for sitemap consistency

// ============================================
// ROOT ROUTE (Explicit API Status)
// ============================================

// Explicit root route to clarify this is an API-only server
// This prevents confusion when health checks or browsers hit the root
app.get('/', (req, res) => {
  res.json({
    service: 'SafeSpot API',
    version: '1.0.0',
    status: 'online',
    message: 'This is an API-only server. Frontend is served at https://safespot.netlify.app',
    endpoints: {
      health: '/health',
      api: '/api/*'
    }
  });
});

// ============================================
// 404 HANDLER FOR NON-API ROUTES
// ============================================

// This backend is API-only. Any non-API route should return 404 JSON.
// The frontend is served separately by Netlify.
app.use((req, res, next) => {
  // If we reach here, no route matched. 
  // If it's an API or SEO route, send a specific 404.
  if (req.path.startsWith('/api/') || req.path.startsWith('/seo/')) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Endpoint ${req.method} ${req.originalUrl} not found in SafeSpot API`
    });
  }

  // Default fallback for everything else
  res.status(404).json({
    error: 'Not Found',
    message: 'SafeSpot API - This is a backend-only server.'
  });
});

// ============================================
// 404 HANDLER FOR API ROUTES
// ============================================

app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `API Route ${req.method} ${req.originalUrl} not found`
  });
});

// ============================================
// GLOBAL ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {
  // Log error details for internal debugging
  console.error(`[API ERROR] ${req.method} ${req.url}:`, err);

  // Default values
  let status = err.status || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Ocurrió un error inesperado en el servidor';

  // Handle specific error types
  if (err.name === 'ZodError') {
    status = 422;
    code = 'VALIDATION_ERROR';
    const issues = err.errors || err.issues || [];
    const firstError = issues[0];
    message = firstError
      ? `${firstError.path.join('.')}: ${firstError.message}`
      : 'Error de validación';
  } else if (err.name === 'CustomError') {
    status = err.status;
    code = err.code;
    message = err.message;
  } else if (err.message?.includes('Not allowed by CORS')) {
    status = 403;
    code = 'CORS_ERROR';
    message = 'Origen no permitido';
  }

  // Response structure
  const response = {
    error: true,
    code: code,
    message: message
  };

  // Only include stack in development and if it's a 500 error
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.details = err.details || err.errors;
  }

  // LOG CRITICAL ERRORS (500s) to Admin Task System
  if (status >= 500) {
    logCriticalError(err, req).catch(console.error);
  }

  res.status(status).json(response);
});

// ============================================
// SERVER START
// ============================================

const server = app.listen(PORT, async () => {
  console.log('🚀 SafeSpot API Server');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 CORS Origins: ${allowedOrigins.join(', ')}`);
  console.log('✅ Server ready to accept requests');
});

// INCREASE TIMEOUTS FOR SSE STABILITY
// Prevent random ERR_CONNECTION_RESET in browsers
server.keepAliveTimeout = 120000; // 120s
server.headersTimeout = 130000;  // 130s

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received, shutting down gracefully...`);

  // Close server and allow existing connections to finish
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));



// Handle uncaught exceptions
process.on('uncaughtException', async (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  try {
    await notifyError(err, { type: 'UNCAUGHT_EXCEPTION' });
  } catch (e) {
    console.error('Failed to notify error:', e);
  }
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
  try {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    await notifyError(err, { type: 'UNHANDLED_REJECTION' });
  } catch (e) {
    console.error('Failed to notify rejection:', e);
  }
  process.exit(1);
});


export default app;
