import { getCorrelationId } from '../middleware/correlation.js';
import { NotificationService } from './notificationService.js';

// Environment check
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Standard Structured Logger
 * Outputs JSON lines in production, pretty logs in dev.
 */
/**
 * Log Level Control
 * LOG_LEVEL env var controls output: error | warn | info | debug | trace
 * Default: 'info' in production, 'debug' in development
 */
const LOG_LEVEL = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };
const currentLevel = LEVELS[LOG_LEVEL] ?? LEVELS.info;

const shouldLog = (level) => (LEVELS[level] ?? 0) <= currentLevel;

const logger = {
  error: (message, context = {}) => shouldLog('error') && log('error', message, context),
  warn: (message, context = {}) => shouldLog('warn') && log('warn', message, context),
  info: (message, context = {}) => shouldLog('info') && log('info', message, context),
  debug: (message, context = {}) => shouldLog('debug') && log('debug', message, context),
  trace: (message, context = {}) => shouldLog('trace') && log('trace', message, context)
};

/**
 * Internal Log Function
 */
function log(level, message, context, error = null) {
  const requestId = getCorrelationId();
  const timestamp = new Date().toISOString();

  // 1. Build Standard Log Object
  const logEntry = {
    level,
    timestamp,
    requestId,
    message,
    ...context
  };

  if (error) {
    // Extract error details safely
    logEntry.error = {
      message: error.message || String(error),
      code: error.code || 'UNKNOWN_ERROR',
      stack: error.stack, // Include stack for internal logs (will be sanitized in response)
      details: error.details
    };
  }

  // 2. Output
  if (isProduction) {
    // Production: Single line JSON
    console.log(JSON.stringify(logEntry));
  } else {
    // Development: Pretty Print
    const color = getColor(level);
    const contextStr = Object.keys(context).length ? JSON.stringify(context) : '';
    const reqStr = requestId !== 'NO_CONTEXT' ? `[${requestId}]` : '';

    console.log(`${color}[${timestamp}] ${level.toUpperCase()} ${reqStr}: ${message}\x1b[0m`, contextStr);

    if (error) {
      console.error(error); // Print full stack trace in dev
    }
  }

  // 3. Error Notification (Critical Only)
  if (level === 'error') {
    // Prevent recursive loop if notifyError fails
    try {
      // Don't await to avoid blocking response
      const notificationContext = { requestId, ...context };
      NotificationService.notifyError(error || new Error(message), notificationContext).catch(() => { });
    } catch (e) {
      // Silent fail
    }
  }
}

function getColor(level) {
  switch (level) {
    case 'info': return '\x1b[36m'; // Cyan
    case 'warn': return '\x1b[33m'; // Yellow
    case 'error': return '\x1b[31m'; // Red
    case 'debug': return '\x1b[90m'; // Gray
    case 'trace': return '\x1b[90m'; // Gray (darker)
    default: return '\x1b[37m'; // White
  }
}

// ==========================================
// Compatibility Layer (Replacing old logger.js exports)
// ==========================================

export const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log request start at TRACE level only (very verbose, disabled by default)
  // Use LOG_LEVEL=trace to see individual requests
  const NOISY_ROUTES = ['/health', '/api/users/profile', '/api/users/transparency-log', '/api/sync', '/api/diagnostics', '/api/presence', '/api/realtime'];
  const isNoisy = NOISY_ROUTES.some(route => req.url.startsWith(route));

  if (!isNoisy && shouldLog('trace')) {
    logger.trace(`Incoming ${req.method} ${req.url}`);
  }

  // Hook into response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    // ENTERPRISE LOGGING RULES:
    // 1. Only log errors (status >= 400)
    // 2. Only log slow requests (>1000ms)
    // 3. Skip all noisy background routes
    const isError = status >= 400;
    const isSlow = duration > 1000;

    if ((isError || isSlow) && !isNoisy) {
      let level = status >= 500 ? 'error' : 'warn';

      // OPTIMIZATION: 404s are often "expected" (e.g. following a deleted report link)
      // Log as info to avoid visual alarm in terminal
      if (status === 404) level = 'info';

      const meta = {
        statusCode: status,
        duration: `${duration}ms`,
        ip: req.ip,
        anonymousId: req.headers['x-anonymous-id']
      };

      if (level === 'error') {
        logger.error(`${req.method} ${req.url}`, null, meta);
      } else if (level === 'warn') {
        logger.warn(`${req.method} ${req.url}`, meta);
      } else {
        logger.info(`${req.method} ${req.url}`, meta);
      }
    }
  });

  next();
};

// Deprecated function replacements ensuring backward compatibility
export const logError = (error, reqOrContext) => {
  // Try to extract context if passed
  let context = {};
  if (reqOrContext && reqOrContext.headers) {
    // It's a request object
    context = {
      path: reqOrContext.path,
      method: reqOrContext.method,
      ip: reqOrContext.ip,
      anonymousId: reqOrContext.headers['x-anonymous-id']
    };
  } else if (typeof reqOrContext === 'object') {
    context = reqOrContext;
  }

  logger.error(error.message || 'Legacy logError called', error, context);
};

export const logSuccess = (message, data) => {
  logger.info(message, data);
};

export const logInfo = (message, data) => {
  logger.info(message, data);
};

export default logger;
