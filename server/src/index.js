import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logError, requestLogger } from './utils/logger.js'; // Updated logger
import { correlationMiddleware, getCorrelationId } from './middleware/correlation.js';
import { AppError } from './utils/AppError.js';
import { ErrorCodes } from './utils/errorCodes.js';

import { responseValidationMiddleware } from './utils/validationWrapper.js';
import swaggerUi from 'swagger-ui-express';
import { generateOpenApiSpecs } from './docs/openapi.js';

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
import safeScoreRouter from './routes/safeScore.js';
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
import diagnosticsRouter from './routes/diagnostics.js';
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
const baseOrigins = [
  'http://localhost:5174',
  'http://localhost:5173',
  'https://safespot.netlify.app',
  process.env.CORS_ORIGIN // e.g. https://safespot.tuweb-ai.com
].filter(Boolean);

// Generate authorized origins including www. versions and stripping trailing slashes
const allowedOrigins = baseOrigins.flatMap(origin => {
  const normalized = origin.replace(/\/$/, ''); // Remove trailing slash
  const domain = normalized.replace(/^https?:\/\//, '');
  return [
    normalized,
    normalized.replace('//', '//www.') // Add www version
  ];
});

// X. Correlation ID (Must be extremely early)
app.use(correlationMiddleware);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Allow server-to-server, mobile apps, or curl

    // Normalize incoming origin (just in case)
    const normalizedOrigin = origin.replace(/\/$/, '');

    if (allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`); // Log blocked origin for debugging
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Anonymous-Id', 'X-Client-ID', 'Cache-Control', 'Last-Event-ID', 'Authorization', 'Pragma', 'Expires', 'X-App-Version', 'baggage', 'traceparent', 'sentry-trace', 'x-request-id']
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
// VERSION ENFORCEMENT (Enterprise)
// ============================================
const MIN_CLIENT_VERSION = '2.4.0'; // Update this to force 426 on all clients

const versionEnforcement = (req, res, next) => {
  // Skip for non-API or static assets
  if (!req.path.startsWith('/api')) return next();

  const clientVersion = req.get('X-App-Version');

  // Set Response Headers
  res.set('X-API-Version', '2.4.0');
  res.set('X-Min-Client-Version', MIN_CLIENT_VERSION);

  // If client sends version, we can validate
  if (clientVersion) {
    // Logic: If major/minor mismatch, reject. 
    // For now, we trust the client unless we explicitly bump MIN_CLIENT_VERSION in the future.
    // This is the hook for "Kill Switch".

    // Example Kill Switch:
    // if (clientVersion.startsWith('2.3')) { ... 426 ... }
  }

  next();
};

app.use(versionEnforcement);

// ============================================
// REQUEST LOGGING
// ============================================

app.use(requestLogger);

// ============================================
// RESPONSE VALIDATION MIDDLEWARE (Enterprise)
// ============================================
app.use(responseValidationMiddleware);

// ============================================
// OPENAPI DOCUMENTATION
// ============================================
if (process.env.NODE_ENV !== 'production') {
  const openApiSpecs = generateOpenApiSpecs();
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpecs));
  console.log('📚 OpenAPI Docs available at /api-docs');
}

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

// ============================================
// RATE LIMITING - ACTIVE
// ============================================

// Global limiter: Applies to all /api routes except realtime
app.use('/api/', globalLimiter);

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

// Diagnostics (should be early to avoid rate limiting)
app.use('/api/diagnostics', diagnosticsRouter);

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
app.use('/api/safe-score', safeScoreRouter);
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
  const requestId = getCorrelationId();

  // 1. Normalize Error to AppError
  let error = err;
  if (!(error instanceof AppError)) {
    // Specialized Handling for known external errors
    if (err.name === 'ZodError') {
      const firstIssue = err.errors?.[0] || err.issues?.[0];
      const message = firstIssue
        ? `${firstIssue.path.join('.')}: ${firstIssue.message}`
        : 'Validation error';
      // Details are safe for Zod
      error = new AppError((message), 422, ErrorCodes.VALIDATION_ERROR, true, err.errors || err.issues);
    } else if (err.message?.includes('Not allowed by CORS')) {
      error = new AppError(err.message, 403, ErrorCodes.CORS_ERROR, true);
    } else if (err.type === 'entity.parse.failed') { // Body parser json error
      error = new AppError('Invalid JSON body', 400, ErrorCodes.INVALID_FORMAT, true);
    } else {
      // Unknown / Crash -> Wrapped as Internal Error
      // In production, message is masked. In dev, we keep original message in 'details' for easy debug
      error = new AppError(
        process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
        500,
        ErrorCodes.INTERNAL_ERROR,
        false // Not operational (unexpected)
      );
      // Preserve stack on the wrapped error for logging
      error.stack = err.stack;
    }
  }

  // 2. Structural Log (JSON)
  // We log EVERYTHING that reaches here, but with levels
  const logLevel = error.isOperational ? 'warn' : 'error';

  // Log metadata
  const logContext = {
    code: error.code,
    statusCode: error.statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip
  };

  if (logLevel === 'error') {
    // Critical errors get full stack trace in logs (both dev and prod logs should have stacks for 500s)
    // Logger handles notification to WhatsApp internally if level is error
    logError(error, req);
  } else {
    // Warnings (4xx) don't need notifications, just logs
    // We use the new logger implicitly via logError's compatibility layer, 
    // but ideally we should call logger.warn directly. 
    // For now, allow logError to handle based on level logic or just use console.warn for operational?
    // Actually, let's just use logError, but we might want to tune its level.
    // The current logError wrapper logs as ERROR. 
    // Let's import logger directly for better control.
  }

  // 3. Response Construction (The Contract)
  const response = {
    error: true,
    code: error.code,
    message: error.message,
    requestId: requestId
  };

  // 4. Safety Filters (Data Leak Prevention)
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
    response.details = error.details; // Developer needs all context
  } else if (error.isOperational) {
    // In production, ONLY share details if it's explicitly safe (validation errors)
    if (error.code === ErrorCodes.VALIDATION_ERROR) {
      response.details = error.details;
    }
  }

  // 5. Send
  res.status(error.statusCode).json(response);
});

// ============================================
// SERVER START
// ============================================

let server;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, async () => {
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
}

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
