// SILENCIO TOTAL: Interceptar inmediatamente console.log/warn para eliminar ruido de infraestructura
const originalLog = console.log;
const originalWarn = console.warn;
const IS_PROD = process.env.NODE_ENV === 'production';
const DEBUG = process.env.DEBUG;

const silenceFilter = (...args) => {
  const msg = args[0]?.toString() || '';
  if (msg.includes('[NotificationEngine]') ||
    msg.includes('[RealtimeEvents]') ||
    msg.includes('Eviction policy') ||
    msg.includes('volatile-lru')) {
    if (!DEBUG) return true; // Silenced
  }
  return false; // Show
};

console.log = (...args) => { if (!silenceFilter(...args)) originalLog(...args); };
console.warn = (...args) => { if (!silenceFilter(...args)) originalWarn(...args); };

import dotenv from 'dotenv';
import { NotificationWorker } from './engine/NotificationWorker.js';

dotenv.config();

// Force reload for Motor 2 identity sync

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

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
import reportLifecycleRouter from './routes/reportLifecycle.js';

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
import syncRouter from './routes/sync.js';
import { logCriticalError } from './utils/adminTasks.js';
import { NotificationService } from './utils/notificationService.js';
import { strictAdminGateway } from './utils/adminGateway.js';

// Load environment variables
// dotenv.config(); (Redundant, already called at top)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// ============================================
// DEVELOPMENT CONTRACT GUARD (Assertion)
// ============================================
// ⚠️ Only active in non-production environments
// Throws an error if legacy fields like 'likes_count' are detected in JSON responses.
if (process.env.NODE_ENV !== 'production') {
  const originalJson = app.response.json;
  app.response.json = function (body) {
    if (body && typeof body === 'object') {
      const jsonStr = JSON.stringify(body);
      if (jsonStr.includes('"likes_count"') || jsonStr.includes('likesCount')) {
        console.error('❌ BACKEND CONTRACT VIOLATION: likes_count detected in response body!');
        console.error('Payload sample:', jsonStr.substring(0, 500));
        throw new Error('BACKEND CONTRACT VIOLATION: legacy field detected. Projection cleanup REQUIRED.');
      }
    }
    return originalJson.call(this, body);
  };
}

const PORT = process.env.PORT || 3000;

// ============================================
// ENVIRONMENT VALIDATION
// ============================================

const requiredEnvVars = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
const IS_TEST = process.env.NODE_ENV === 'test';

if (!IS_TEST && missingVars.length > 0) {
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

// Y. Cookie Parser (Required for Zero-Trust Assets)
app.use(cookieParser());


app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Allow server-to-server, mobile apps, or curl

    // Normalize incoming origin (just in case)
    const normalizedOrigin = origin.replace(/\/$/, '');

    // 1. Direct match in whitelist
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // 2. Dynamic Netlify Subdomains (Previews/Deploys)
    // Format: https://random-hash--sitename.netlify.app
    const isNetlifyPreview = /^https:\/\/.*--(safespotar|safespot)\.netlify\.app$/.test(normalizedOrigin);
    if (isNetlifyPreview) {
      console.log(`[CORS] Shared access granted to Netlify preview: ${origin}`);
      return callback(null, true);
    }

    // 3. Block otherwise
    console.warn(`[CORS] Blocked origin: ${origin}`); // Log blocked origin for debugging
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'X-Anonymous-Id',
    'X-Anonymous-Signature',
    'X-Client-ID',
    'Cache-Control',
    'Last-Event-ID',
    'Authorization',
    'Pragma',
    'Expires',
    'X-App-Version',
    'baggage',
    'traceparent',
    'sentry-trace',
    'X-Request-ID',
    'X-Trace-ID',
    'X-Instance-ID'
  ]
}));

// 2. Real-time SSE (Must be before Helmet and Rate Limiters)
// These connections are long-lived and Helmet/RateLimits can cause resets
app.use('/api/realtime', realtimeRouter);

// 3. Security Middleware (Helmet)
// Helmet is applied AFTER realtime to avoid interfering with SSE headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": [
        "'self'",
        "data:",
        "blob:",
        "https://lh3.googleusercontent.com",
        "https://*.supabase.co",
        "https://api.dicebear.com"
      ],
    },
  },
}));

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
  max: 500,
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
app.use('/api/sync', syncRouter);

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/reports', reportLifecycleRouter); // Semantic Lifecycle Commands overrides
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
// Admins (Authentication is PUBLIC, functionality is PROTECTED)
app.use('/api/admin/auth', adminAuthRouter);

// Apply strict gateway to all functional administrative sectors
app.use('/api/admin', strictAdminGateway);

// Mount Admin Sub-Routers
app.use('/api/admin/stats', adminStatsRouter);
app.use('/api/admin/heatmap', adminHeatmapRouter);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/admin/moderation', adminModerationRouter);
app.use('/api/admin/tasks', adminTasksRouter);

app.use('/api/user-zones', userZonesRouter);

app.use('/api/chats', chatsRouter);

app.use('/api', sitemapRouter);
app.use('/api/seo', seoRouter); // Also expose under /api for sitemap consistency


// ============================================
// ADMIN ASSET GATEWAY (Enterprise Isolation)
// ============================================

/**
 * Enterprise Rule: The login shell is public, the dashboard code is PRIVATE.
 * We serve the admin.html bootstrapper to everyone, but the actual 
 * business logic chunks are locked behind the gateway.
 */
app.get(['/admin', '/admin/', '/admin/login'], (req, res) => {
  const adminPath = path.resolve(__dirname, '../../dist/admin.html');
  if (fs.existsSync(adminPath)) {
    // 🛡️ SECURITY: Force freshness for the bootloader
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(adminPath);
  }
  res.status(404).send('Admin Environment Offline (Run build)');
});


// Serve the admin shell for all admin sub-routes (SPA support)
// 📌 SECURITY: The HTML is public, the JS/CSS modules it loads are protected.
app.get('/admin/*', (req, res) => {
  const adminPath = path.resolve(__dirname, '../../dist/admin.html');
  if (fs.existsSync(adminPath)) {
    return res.sendFile(adminPath);
  }
  res.status(404).send('Admin Context Not Found');
});



/**
 * Enterprise Rule: Admin assets are SENSITIVE.
 * No JS or CSS from the INTERNAL admin bundle can be served without a valid JWT.
 * The PUBLIC segment (Login form) is served openly to allow authentication.
 */
app.use('/admin-assets/public', express.static(path.resolve(__dirname, '../../dist/admin-assets/public')));
app.use('/admin-assets/internal', strictAdminGateway, express.static(path.resolve(__dirname, '../../dist/admin-assets/internal')));






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
    // Logger handles notification to Telegram internally if level is error
    NotificationService.notifyError(error, { path: req.path, method: req.method });
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
// SERVER START (Singleton Guard)
// ============================================

let server;
let isStarting = false;
const activeSockets = new Set();

/**
 * Starts the Express server with protection against double-listening
 */
const startServer = () => {
  if (isStarting) return;
  isStarting = true;

  if (process.env.NODE_ENV === 'test') return;

  const isProduction = process.env.NODE_ENV === 'production';
  server = app.listen(PORT, () => {
    if (!isProduction || process.env.DEBUG) {
      console.log(`🚀 SafeSpot API Server | Port: ${PORT} | Env: ${process.env.NODE_ENV || 'development'}`);
    } else {
      console.log(`🚀 SafeSpot API Server ready on port ${PORT}`);
    }

    // INCREASE TIMEOUTS FOR SSE STABILITY
    server.keepAliveTimeout = 120000;
    server.headersTimeout = 130000;
  });

  // 🛡️ Socket Tracking for Forced Shutdown
  server.on('connection', (socket) => {
    activeSockets.add(socket);
    socket.on('close', () => activeSockets.delete(socket));
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ CRITICAL: Port ${PORT} is already in use.`);
      console.error(`💡 Pro tip: Kill existing process holding the port.`);
      process.exit(1);
    }
  });
};

// ============================================
// GRACEFUL SHUTDOWN (Real Resource Cleanup)
// ============================================

const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received, shutting down...`);

  if (server) {
    console.log(`🛑 Closing HTTP server and destroying ${activeSockets.size} active sockets...`);

    // Force-terminate all active connections (required for SSE stability during restarts)
    for (const socket of activeSockets) {
      socket.destroy();
    }

    server.close(() => {
      console.log('HTTP server closed.');
    });
  }

  // Faster termination for dev agility
  setTimeout(() => {
    console.log('Process exit.');
    process.exit(0);
  }, 200).unref();
};


process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', async (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  try {
    await NotificationService.notifyError(err, { type: 'UNCAUGHT_EXCEPTION' });
  } catch (e) {
    console.error('Failed to notify error:', e);
  }
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
  try {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    await NotificationService.notifyError(err, { type: 'UNHANDLED_REJECTION' });
  } catch (e) {
    console.error('Failed to notify rejection:', e);
  }
  process.exit(1);
});

// AUTO-BOOTSTRAP if run directly
const isMainModule = fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule || process.env.NODE_WATCH === 'true') {
  startServer();
}

export default app;
export { startServer };

