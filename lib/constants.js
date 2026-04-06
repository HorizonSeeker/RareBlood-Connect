/**
 * Centralized Constants for RareBlood_Connect
 * Eliminates magic numbers across codebase
 */

// ====================================
// AUTO-ROUTING & SOS CONFIGURATION
// ====================================
export const AUTO_ROUTING = {
  // Search radius for finding alternative blood banks
  SEARCH_RADIUS_KM: 50,
  
  // SOS broadcast radius for donor notifications
  SOS_RADIUS_KM: 10,
  
  // Fallback search radius if primary search fails
  FALLBACK_RADIUS_KM: 15,
  
  // Time window to look for related donor contact requests
  TIME_WINDOW_MINUTES: 15,
  
  // Maximum donors to return per SOS broadcast
  MAX_DONORS_PER_BROADCAST: 100,
  
  // Maximum number of blood banks to try during auto-routing
  MAX_BLOOD_BANKS_TO_TRY: 5,
  
  // Geospatial query result limit for safety
  DONOR_LIMIT_QUERIES: 1000
};

// ====================================
// TOKEN & EXPIRY CONFIGURATION
// ====================================
export const TOKEN = {
  // FCM/Contact request token expiry
  EXPIRY_HOURS: 24,
  
  // JWT token expiry
  JWT_EXPIRY_HOURS: 72,
  
  // Refresh token expiry
  REFRESH_EXPIRY_DAYS: 30
};

// ====================================
// VALIDATION CONSTRAINTS
// ====================================
export const VALIDATION = {
  // Password requirements
  PASSWORD: {
    MIN_LENGTH: 12,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL_CHAR: true,
    // Regex: min 12 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/
  },

  // Email validation
  EMAIL: {
    MAX_LENGTH: 254,
    REGEX: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  },

  // Phone number validation (supports international formats)
  PHONE: {
    REGEX: /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/
  },

  // Driver name validation
  DRIVER_NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 100,
    // Only alphanumeric, spaces, hyphens, apostrophes
    REGEX: /^[a-zA-Z0-9\s\-'.]+$/
  },

  // Request body size limits
  MAX_REQUEST_SIZE_KB: 10,
  
  // Blood unit quantity limits
  UNITS_REQUESTED: {
    MIN: 1,
    MAX: 100
  },

  // Delivery time limits
  DELIVERY_MINUTES: {
    MIN: 1,
    MAX: 1440  // 24 hours
  }
};

// ====================================
// DATABASE & API LIMITS
// ====================================
export const LIMITS = {
  // Query result pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // Concurrent operations
  MAX_CONCURRENT_FCMS: 50,
  
  // Rate limiting
  API_RATE_LIMIT_PER_MINUTE: 100,
  
  // Database timeouts
  DB_QUERY_TIMEOUT_MS: 30000,
  
  // Request timeout
  REQUEST_TIMEOUT_MS: 60000
};

// ====================================
// HTTP STATUS CODES & ERROR MESSAGES
// ====================================
export const ERRORS = {
  // Custom error codes for better debugging
  RACE_CONDITION_DETECTED: {
    code: 'RACE_CONDITION_DETECTED',
    status: 409,
    message: 'Inventory exhausted by another request'
  },
  
  LOCATION_REQUIRED: {
    code: 'LOCATION_REQUIRED',
    status: 400,
    message: 'Emergency requests require valid location data'
  },
  
  INVALID_PHONE_FORMAT: {
    code: 'INVALID_PHONE_FORMAT',
    status: 400,
    message: 'Invalid phone number format'
  },
  
  INVALID_NAME_FORMAT: {
    code: 'INVALID_NAME_FORMAT',
    status: 400,
    message: 'Driver name contains invalid characters'
  },
  
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    status: 401,
    message: 'Invalid email or password'
  },
  
  INSUFFICIENT_INVENTORY: {
    code: 'INSUFFICIENT_INVENTORY',
    status: 400,
    message: 'Insufficient blood units available'
  },
  
  WEAK_PASSWORD: {
    code: 'WEAK_PASSWORD',
    status: 400,
    message: 'Password must be at least 12 characters with uppercase, lowercase, number, and special character'
  },
  
  REQUEST_TOO_LARGE: {
    code: 'REQUEST_TOO_LARGE',
    status: 413,
    message: 'Request body too large'
  },
  
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    status: 401,
    message: 'Unauthorized - Please login or provide Bearer token'
  },
  
  FORBIDDEN: {
    code: 'FORBIDDEN',
    status: 403,
    message: 'Access denied'
  },
  
  NOT_FOUND: {
    code: 'NOT_FOUND',
    status: 404,
    message: 'Resource not found'
  }
};

// ====================================
// FEATURE FLAGS
// ====================================
export const FEATURES = {
  // Enable/disable auto-routing for emergency requests
  ENABLE_AUTO_ROUTING: true,
  
  // Enable/disable SOS broadcast to nearby donors
  ENABLE_SOS_BROADCAST: true,
  
  // Enable/disable geospatial queries
  ENABLE_GEOSPATIAL: true,
  
  // Enable/disable FCM notifications
  ENABLE_FCM: true,
  
  // Enable/disable Pusher real-time updates
  ENABLE_PUSHER: true
};

// ====================================
// LOGGING & DEBUGGING
// ====================================
export const LOGGING = {
  // Log level: 'debug', 'info', 'warn', 'error'
  LEVEL: process.env.LOG_LEVEL || 'info',
  
  // Include request ID in all logs
  INCLUDE_REQUEST_ID: true,
  
  // Include user ID in relevant logs
  INCLUDE_USER_ID: true,
  
  // Log request/response bodies (size limit to prevent spam)
  LOG_BODY_MAX_SIZE: 500
};

export default {
  AUTO_ROUTING,
  TOKEN,
  VALIDATION,
  LIMITS,
  ERRORS,
  FEATURES,
  LOGGING
};
