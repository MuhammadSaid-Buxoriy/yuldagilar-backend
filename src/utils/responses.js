// =====================================================
// API RESPONSE UTILITIES - Frontend Compatible
// =====================================================
// File: src/utils/responses.js

/**
 * Send successful response
 * @param {Object} res - Express response object
 * @param {Object} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Express response
 */
export const sendSuccess = (res, data = {}, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString(),
    ...data
  };
  
  return res.status(statusCode).json(response);
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {Object} details - Additional error details
 * @returns {Object} Express response
 */
export const sendError = (res, message = 'Error occurred', statusCode = 400, details = {}) => {
  const response = {
    success: false,
    error: true,
    message,
    timestamp: new Date().toISOString(),
    ...details
  };
  
  // Log error in development
  if (process.env.NODE_ENV !== 'production') {
    console.error(`❌ API Error [${statusCode}]:`, message, details);
  }
  
  return res.status(statusCode).json(response);
};

/**
 * Send not found response
 * @param {Object} res - Express response object
 * @param {string} resource - Resource name
 * @returns {Object} Express response
 */
export const sendNotFound = (res, resource = 'Resource') => {
  return sendError(res, `${resource} not found`, 404);
};

/**
 * Send server error response
 * @param {Object} res - Express response object
 * @param {Error} error - Error object
 * @returns {Object} Express response
 */
export const sendServerError = (res, error) => {
  console.error('🔥 Server Error:', error.message || error);
  console.error('📚 Stack:', error.stack);
  
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message || 'Unknown server error';
    
  return sendError(res, message, 500, {
    ...(process.env.NODE_ENV !== 'production' && { 
      error_type: error.name,
      stack: error.stack 
    })
  });
};

/**
 * Async handler wrapper for Express routes
 * Automatically catches async errors and passes them to error handler
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware function
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};