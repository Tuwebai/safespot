import morgan from 'morgan';
import { notifyError } from './whatsapp.js';

// Define custom token for anonymous_id
morgan.token('anonymous_id', (req) => {
  return req.headers['x-anonymous-id'] || '-';
});

// Custom log format
const logFormat = ':method :url :status :response-time ms - :anonymous_id';

// Create logger middleware
export const requestLogger = morgan(logFormat, {
  skip: (req) => {
    // Skip health checks
    return req.url === '/health';
  },
});

// Detailed logging function (disabled to reduce console noise)
// Use morgan's requestLogger instead
export function logRequest(req, res, next) {
  next();
}

// Error logger
export function logError(error, reqOrId) {
  let anonymousId = 'MISSING';
  let context = {};

  if (typeof reqOrId === 'string') {
    anonymousId = reqOrId;
  } else if (reqOrId?.headers) {
    anonymousId = reqOrId.headers['x-anonymous-id'] || 'MISSING';
    context = {
      path: reqOrId.path,
      method: reqOrId.method,
      ip: reqOrId.ip
    };
  } else if (reqOrId?.anonymousId) {
    anonymousId = reqOrId.anonymousId;
    context = reqOrId; // Assuming passed object is context
  } else if (typeof reqOrId === 'object') {
    context = reqOrId;
  }

  const timestamp = new Date().toISOString();

  console.error(`[${timestamp}] ERROR`);
  console.error(`  Anonymous ID: ${anonymousId}`);
  console.error(`  Path: ${context?.path || 'N/A'}`);
  console.error(`  Error:`, error.message || error);
  if (error.stack) {
    console.error(`  Stack:`, error.stack);
  }

  // Send to WhatsApp via n8n
  // Filter out minor validation errors if needed, but for now send all
  notifyError(error, { anonymousId, ...context });
}

// Success logger (disabled to reduce console noise)
export function logSuccess(message, data = {}) {
  // Only log in development mode
  if (process.env.NODE_ENV === 'development') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ✅ ${message}`);
  }
}

