import morgan from 'morgan';

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
export function logError(error, req) {
  const anonymousId = req?.headers['x-anonymous-id'] || 'MISSING';
  const timestamp = new Date().toISOString();
  
  console.error(`[${timestamp}] ERROR`);
  console.error(`  Anonymous ID: ${anonymousId}`);
  console.error(`  Path: ${req?.path || 'N/A'}`);
  console.error(`  Error:`, error.message);
  console.error(`  Stack:`, error.stack);
}

// Success logger (disabled to reduce console noise)
export function logSuccess(message, data = {}) {
  // Only log in development mode
  if (process.env.NODE_ENV === 'development') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ✅ ${message}`);
  }
}

