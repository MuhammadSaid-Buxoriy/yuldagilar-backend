import logger from '../utils/logger.js';

/**
 * Global error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  // Log error details
  logger.error('Global error handler triggered:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Default error response
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';
  let errorType = err.name || 'UnknownError';

  // Handle specific error types
  if (err.code === 'PGRST301') {
    // Supabase RLS policy violation
    statusCode = 403;
    message = 'Access denied';
    errorType = 'AccessDenied';
  } else if (err.code === 'PGRST116') {
    // Supabase no rows returned
    statusCode = 404;
    message = 'Resource not found';
    errorType = 'NotFound';
  } else if (err.code === '23505') {
    // PostgreSQL unique violation
    statusCode = 409;
    message = 'Resource already exists';
    errorType = 'DuplicateEntry';
  } else if (err.code === '23503') {
    // PostgreSQL foreign key violation
    statusCode = 400;
    message = 'Invalid reference';
    errorType = 'InvalidReference';
  } else if (err.code === '42P01') {
    // PostgreSQL table doesn't exist
    statusCode = 500;
    message = 'Database configuration error';
    errorType = 'DatabaseError';
  } else if (err.name === 'ValidationError') {
    // Joi validation error
    statusCode = 400;
    message = 'Validation failed';
    errorType = 'ValidationError';
  } else if (err.name === 'CastError') {
    // Invalid ID format
    statusCode = 400;
    message = 'Invalid ID format';
    errorType = 'InvalidFormat';
  } else if (err.code === 'ECONNREFUSED') {
    // Database connection refused
    statusCode = 503;
    message = 'Service temporarily unavailable';
    errorType = 'ServiceUnavailable';
  } else if (err.code === 'ETIMEDOUT') {
    // Request timeout
    statusCode = 408;
    message = 'Request timeout';
    errorType = 'RequestTimeout';
  }

  // Don't leak sensitive information in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const errorResponse = {
    success: false,
    error: true,
    message: message,
    type: errorType,
    timestamp: new Date().toISOString(),
    requestId: req.id || req.headers['x-request-id'] || generateRequestId()
  };

  // Add debug information in development
  if (isDevelopment) {
    errorResponse.details = {
      originalMessage: err.message,
      stack: err.stack,
      code: err.code,
      path: req.path,
      method: req.method
    };
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 handler for unknown routes
 */
export const notFoundHandler = (req, res) => {
  logger.warn('Route not found:', {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    success: false,
    error: "Route not found",
    message: `Cannot ${req.method} ${req.path}`,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      "GET /",
      "GET /api/health",
      "POST /api/auth/check",
      "GET /api/users/:userId/statistics",
      "GET /api/users/:userId/achievements/progress",
      "POST /api/tasks/submit",
      "GET /api/leaderboard",
    ],
  });
};

/**
 * Generate unique request ID
 */
function generateRequestId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}