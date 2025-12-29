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
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5174';

// ============================================
// MIDDLEWARE
// ============================================

// Security
app.use(helmet());

// CORS
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Anonymous-Id']
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (morgan only, skip detailed logRequest)
app.use(requestLogger);

// Rate limiting
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
// ROUTES
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'SafeSpot Anonymous Backend'
  });
});

// API Routes
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

// ============================================
// STATIC FILES & SPA ROUTING
// ============================================

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from the 'dist' directory (frontend build)
// This must be AFTER API routes to avoid intercepting /api calls
const distPath = path.join(__dirname, '../../dist');
app.use(express.static(distPath));

// SPA Fallback: Serve index.html for any request that doesn't match an API route or static file
// This is critical for client-side routing (React Router) to work on refresh
app.get('*', (req, res, next) => {
  // If it's an API request that reached here, it's a 404 API route
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler for API routes (since GET * handles others)
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `API Route ${req.method} ${req.originalUrl} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  // Enhanced production logging
  console.error(`[SERVER ERROR] ${req.method} ${req.url}:`, err);

  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal Server Error' : err.message,
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// SERVER START
// ============================================

app.listen(PORT, async () => {
  console.log('🚀 SafeSpot Backend - Port', PORT);

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL not found in environment variables');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

export default app;

