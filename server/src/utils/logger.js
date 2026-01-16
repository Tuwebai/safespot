import { getCorrelationId } from '../middleware/correlation.js';
import { notifyError } from './whatsapp.js';

// Environment check
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Standard Structured Logger
 * Outputs JSON lines in production, pretty logs in dev.
 */
const logger = {
  info: (message, context = {}) => log('info', message, context),
  warn: (message, context = {}) => log('warn', message, context),
  error: (message, error = null, context = {}) => log('error', message, context, error),
  debug: (message, context = {}) => {
    // Only log debug in non-production or if DEBUG env var is set
    if (!isProduction || process.env.DEBUG) {
      log('debug', message, context);
    }
  }
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
      notifyError(error || new Error(message), notificationContext).catch(() => { });
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
    default: return '\x1b[37m'; // White
  }
}

// ==========================================
// Compatibility Layer (Replacing old logger.js exports)
// ==========================================

export const requestLogger = (req, res, next) => {
  // Morgan replacement: Simple start/finish logging
  const start = Date.now();

  // Log request start (Debug only to reduce noise)
  logger.debug(`Incoming ${req.method} ${req.url}`);

  // Hook into response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    // SMART LOGGING: Skip successful GETs to reduce noise, unless it's slow (>500ms)
    const isSuccessGet = req.method === 'GET' && status < 400;
    const isSlow = duration > 500;

    if (!isSuccessGet || isSlow) {
      logger[level](`${req.method} ${req.url}`, {
        statusCode: status,
        duration: `${duration}ms`,
        ip: req.ip,
        anonymousId: req.headers['x-anonymous-id']
      });
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

export default logger;
