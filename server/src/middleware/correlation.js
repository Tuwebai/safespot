import { AsyncLocalStorage } from 'async_hooks';

// Singleton instance for the entire app
export const correlationStore = new AsyncLocalStorage();

/**
 * Middleware to generate correlation IDs and persist them in AsyncLocalStorage
 * Allows deep access to current requestId without threading 'req' everywhere.
 */
export const correlationMiddleware = (req, res, next) => {
    // Use existing header if present (for distributed tracing), else generate new
    const requestId = req.headers['x-request-id'] || req.headers['x-client-id'] || generateRequestId();

    // Set response header for frontend correlation
    res.setHeader('X-Request-ID', requestId);

    // Attach to request object for legacy access
    req.requestId = requestId;

    // Run next() within the storage context
    correlationStore.run({ requestId }, () => {
        next();
    });
};

/**
 * Helper to get current correlation ID safely
 */
export const getCorrelationId = () => {
    const store = correlationStore.getStore();
    return store?.requestId || 'NO_CONTEXT'; // Fallback if called outside request
};

/**
 * UUID v4 like random string generator (custom performance optimized)
 */
function generateRequestId() {
    return 'req_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}
