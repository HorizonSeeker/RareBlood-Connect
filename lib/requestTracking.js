/**
 * Request Tracking Utility for RareBlood_Connect
 * Provides unique request IDs for end-to-end tracing and debugging
 */

import { randomUUID } from 'crypto';

/**
 * Extract or generate request ID from Next.js request
 * @param {Request} req - Next.js request object
 * @returns {string} - Unique request ID
 */
export function getOrCreateRequestId(req) {
  // Check for request ID in headers
  const headerId = req?.headers?.get?.('x-request-id') ||
                   req?.headers?.['x-request-id'] ||
                   req?.headers?.['x-correlation-id'];

  if (headerId) {
    return headerId;
  }

  // Generate new UUID if not provided
  return randomUUID();
}

/**
 * Wrap async API handler to add request ID tracking
 * @param {Function} handler - API handler function (GET, POST, etc.)
 * @returns {Function} - Wrapped handler with request ID
 */
export function withRequestId(handler) {
  return async (req, res) => {
    const requestId = getOrCreateRequestId(req);

    // Attach requestId to req for use in handler
    req.requestId = requestId;

    // Pass to handler
    return handler(req, res);
  };
}

/**
 * Add request ID to response headers for client tracking
 * @param {Response} response - Next.js response object
 * @param {string} requestId - Request ID to add
 * @returns {Response} - Response with request ID header
 */
export function addRequestIdToResponse(response, requestId) {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('x-request-id', requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

/**
 * Store request context for async operations
 * Useful for maintaining requestId across async tasks
 */
class RequestContext {
  static storage = new Map();

  static set(requestId, context) {
    this.storage.set(requestId, {
      requestId,
      userId: context.userId,
      timestamp: new Date(),
      ...context
    });
  }

  static get(requestId) {
    return this.storage.get(requestId) || { requestId };
  }

  static clear(requestId) {
    this.storage.delete(requestId);
  }

  static clearOld(maxAgeMinutes = 60) {
    const now = new Date();
    for (const [id, context] of this.storage.entries()) {
      const ageMinutes = (now - context.timestamp) / (1000 * 60);
      if (ageMinutes > maxAgeMinutes) {
        this.storage.delete(id);
      }
    }
  }
}

export { RequestContext };

/**
 * Create Next.js middleware for request tracking
 * Usage: Add to middleware.js or use in API routes
 * 
 * import { requestIdMiddleware } from '@/lib/requestTracking';
 * 
 * export const middleware = requestIdMiddleware;
 */
export function requestIdMiddleware(req) {
  const requestId = getOrCreateRequestId(req);
  req.headers.set('x-request-id', requestId);
  return fetch(req);
}

/**
 * Helper to generate structured logging context
 * @param {string} requestId - Request ID
 * @param {string} userId - User ID (optional)
 * @returns {Object} - Context object for logging
 */
export function createLogContext(requestId, userId = null) {
  return {
    requestId,
    userId,
    timestamp: new Date().toISOString(),
    source: 'api'
  };
}

/**
 * Helper to log request start with context
 * @param {string} requestId - Request ID
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} path - Request path
 * @param {string} userId - User ID (optional)
 * @param {Function} logger - Logger function
 */
export function logRequestStart(requestId, method, path, userId = null, logger = console) {
  logger.log(`[${requestId}] ${method} ${path} started`, {
    userId,
    timestamp: new Date().toISOString()
  });
}

/**
 * Helper to log request completion with duration
 * @param {string} requestId - Request ID
 * @param {number} status - HTTP status code
 * @param {number} duration - Request duration in milliseconds
 * @param {Function} logger - Logger function
 */
export function logRequestEnd(requestId, status, duration = 0, logger = console) {
  const statusEmoji = status < 400 ? '✅' : status < 500 ? '⚠️' : '❌';
  logger.log(`[${requestId}] ${statusEmoji} Response ${status} (${duration}ms)`);
}

/**
 * Helper to log errors with request context
 * @param {string} requestId - Request ID
 * @param {string} context - What was happening when error occurred
 * @param {Error} error - Error object
 * @param {Function} logger - Logger function
 */
export function logRequestError(requestId, context, error, logger = console) {
  logger.error(`[${requestId}] ❌ Error in ${context}:`, {
    message: error?.message,
    code: error?.code,
    status: error?.status,
    stack: error?.stack
  });
}

export default {
  getOrCreateRequestId,
  withRequestId,
  addRequestIdToResponse,
  RequestContext,
  requestIdMiddleware,
  createLogContext,
  logRequestStart,
  logRequestEnd,
  logRequestError
};
