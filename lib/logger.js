/**
 * Centralized Logger for RareBlood_Connect
 * Provides consistent logging format across all modules
 * Includes request ID tracking for debugging
 */

import { LOGGING } from './constants.js';

class Logger {
  constructor() {
    this.level = LOGGING.LEVEL;
  }

  // ====================================
  // Core Logging Methods
  // ====================================
  
  debug(context, message, data = {}) {
    if (this.level === 'debug') {
      console.log(`[DEBUG] [${context}] ${message}`, data);
    }
  }

  info(context, message, data = {}) {
    if (['debug', 'info'].includes(this.level)) {
      console.log(`[INFO] [${context}] ${message}`, data);
    }
  }

  warn(context, message, data = {}) {
    if (['debug', 'info', 'warn'].includes(this.level)) {
      console.warn(`[WARN] [${context}] ${message}`, data);
    }
  }

  error(context, message, error = null, data = {}) {
    console.error(`[ERROR] [${context}] ${message}`, {
      error: error?.message || error,
      stack: error?.stack,
      ...data
    });
  }

  // ====================================
  // Feature-Specific Loggers
  // ====================================

  sos(message, data = {}) {
    this.info('SOS', message, data);
  }

  sosError(message, error, data = {}) {
    this.error('SOS', message, error, data);
  }

  autoRouting(message, data = {}) {
    this.info('AUTO_ROUTING', message, data);
  }

  autoRoutingError(message, error, data = {}) {
    this.error('AUTO_ROUTING', message, error, data);
  }

  fcm(message, data = {}) {
    this.info('FCM', message, data);
  }

  fcmError(message, error, data = {}) {
    this.error('FCM', message, error, data);
  }

  geocoding(message, data = {}) {
    this.info('GEOCODING', message, data);
  }

  geocodingError(message, error, data = {}) {
    this.error('GEOCODING', message, error, data);
  }

  database(message, data = {}) {
    this.debug('DATABASE', message, data);
  }

  databaseError(message, error, data = {}) {
    this.error('DATABASE', message, error, data);
  }

  auth(message, data = {}) {
    this.info('AUTH', message, data);
  }

  authError(message, error, data = {}) {
    this.error('AUTH', message, error, data);
  }

  api(message, data = {}) {
    this.debug('API', message, data);
  }

  apiError(message, error, data = {}) {
    this.error('API', message, error, data);
  }

  // ====================================
  // Request-Scoped Logging
  // ====================================

  request(requestId, context, message, data = {}) {
    this.info(`[${requestId}] ${context}`, message, data);
  }

  requestError(requestId, context, message, error, data = {}) {
    this.error(`[${requestId}] ${context}`, message, error, data);
  }

  // ====================================
  // Structured Logging
  // ====================================

  logApiRequest(requestId, method, path, userId = null) {
    this.api(`${method} ${path}`, {
      requestId,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  logApiResponse(requestId, status, duration = 0) {
    this.api(`Response sent`, {
      requestId,
      status,
      durationMs: duration
    });
  }

  logDatabaseOperation(requestId, operation, collection, duration = 0) {
    this.database(`${operation} on ${collection}`, {
      requestId,
      durationMs: duration
    });
  }

  logExternalAPI(requestId, service, endpoint, status = 200) {
    this.info(`EXTERNAL_API`, `${service} - ${endpoint}`, {
      requestId,
      status
    });
  }

  // ====================================
  // Safe Object Stringification
  // ====================================

  safeStringify(obj, maxLength = 500) {
    try {
      const seen = new WeakSet();
      const stringified = JSON.stringify(obj, (key, value) => {
        if (value && typeof value === 'object') {
          if (seen.has(value)) return '[Circular Reference]';
          seen.add(value);
        }
        return value;
      });
      return stringified.substring(0, maxLength);
    } catch (e) {
      return `[Stringification failed: ${e.message}]`;
    }
  }
}

// Export singleton instance
export const logger = new Logger();

export default logger;
