import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { requestLogger } from './utils/logger.js';

// Load environment variables
dotenv.config();

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

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet for security headers
app.use(helmet());

// CORS - Support both localhost (dev) and Netlify (prod)
const allowedOrigins = [
  'http://localhost:5174',
  'http://localhost:5173',
  'https://safespot.netlify.app',
  process.env.CORS_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Anonymous-Id']
}));

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
// RATE LIMITING
// ============================================

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

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

import reportsRouter from './routes/reports.js';
import commentsRouter from './routes/comments.js';
import votesRouter from './routes/votes.js';
import usersRouter from './routes/users.js';
import favoritesRouter from './routes/favorites.js';
import badgesRouter from './routes/badges.js';
import gamificationRouter from './routes/gamification.js';
import testRouter from './routes/test.js';
import geocodeRouter from './routes/geocode.js';
import pushRouter from './routes/push.js';
import seoRouter from './routes/seo.js';
import sitemapRouter from './routes/sitemap.js';

// SEO / Share Proxy Route
// This route serves static HTML for social bots (Facebook, Twitter, WhatsApp)
// It must be mounted before API routes or 404 handlers
app.use('/reporte', seoRouter);

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
app.use('/api', sitemapRouter);

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
  // If it's an API route, let it fall through to the API 404 handler
  if (req.path.startsWith('/api/')) {
    return next();
  }

  // For any other route, return 404 JSON
  res.status(404).json({
    error: 'Not Found',
    message: 'This is an API-only server. The frontend is served at https://safespot.netlify.app'
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
  // Log error details
  console.error(`[SERVER ERROR] ${req.method} ${req.url}:`, err);

  const status = err.status || 500;

  // Never expose stack traces in production
  const response = {
    error: status === 500 ? 'Internal Server Error' : err.message,
    message: err.message
  };

  // Only include stack in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(status).json(response);
});

// ============================================
// SERVER START
// ============================================

app.listen(PORT, async () => {
  console.log('🚀 SafeSpot API Server');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 CORS Origins: ${allowedOrigins.join(', ')}`);
  console.log('✅ Server ready to accept requests');
});

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
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;
