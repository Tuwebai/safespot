import rateLimit from 'express-rate-limit';

/**
 * Rate limiter specifically for flag endpoints (anti-spam)
 * Limits: 5 flags per minute per anonymous ID or IP
 */
export const flagRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 flags per minute
  message: {
    error: 'Too many flag requests',
    message: 'You have exceeded the maximum number of flags allowed. Please try again in a minute.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use anonymous ID if available, otherwise fall back to IP
  keyGenerator: (req) => {
    // Try to use anonymous_id from header for better tracking
    const anonymousId = req.headers['x-anonymous-id'];
    if (anonymousId) {
      return `flag:${anonymousId}`;
    }
    // Fall back to IP if no anonymous_id
    return `flag:${req.ip}`;
  },
  // Custom handler to return consistent error format
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many flag requests',
      message: 'You have exceeded the maximum number of flags allowed. Please try again in a minute.',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }
});

