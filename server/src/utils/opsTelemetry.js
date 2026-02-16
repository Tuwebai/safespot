import logger from './logger.js';

function sanitizePath(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') return '/';
  try {
    const url = new URL(inputUrl, 'http://localhost');
    return url.pathname || '/';
  } catch {
    return inputUrl.split('?')[0] || '/';
  }
}

function resolveRequestId(req) {
  return req.requestId || req.id || req.headers['x-request-id'] || null;
}

export function attachOpsRequestTelemetry(domain) {
  return (req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      logger.info('METRIC_HTTP_REQUEST', {
        metric: 'http_request',
        domain,
        method: req.method,
        endpoint: sanitizePath(req.originalUrl || req.url),
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        requestId: resolveRequestId(req)
      });
    });
    next();
  };
}

export function logRealtimeAuthzDenied(req, { endpoint, reason, statusCode }) {
  logger.warn('METRIC_REALTIME_AUTHZ_DENIED', {
    metric: 'realtime_authz_denied',
    endpoint: sanitizePath(endpoint || req.originalUrl || req.url),
    reason,
    statusCode,
    requestId: resolveRequestId(req)
  });
}

export function logRealtimeCatchup(req, { statusCode, durationMs, eventCount }) {
  logger.info('METRIC_REALTIME_CATCHUP', {
    metric: 'realtime_catchup',
    endpoint: '/api/realtime/catchup',
    statusCode,
    durationMs,
    eventCount: Number.isFinite(eventCount) ? eventCount : 0,
    requestId: resolveRequestId(req)
  });
}

export function logChatAckFailure(req, { flow, statusCode, reason, deliveredFailed = 0, readFailed = 0 }) {
  logger.warn('METRIC_CHAT_ACK_FAILURE', {
    metric: 'chat_ack_failure',
    flow,
    statusCode,
    reason,
    deliveredFailed,
    readFailed,
    requestId: resolveRequestId(req)
  });
}

export function logAuth5xx(req, { statusCode, durationMs, code = 'INTERNAL_ERROR' }) {
  logger.error('METRIC_AUTH_5XX', {
    metric: 'auth_5xx',
    endpoint: sanitizePath(req.originalUrl || req.url),
    statusCode,
    durationMs,
    code,
    requestId: resolveRequestId(req)
  });
}
