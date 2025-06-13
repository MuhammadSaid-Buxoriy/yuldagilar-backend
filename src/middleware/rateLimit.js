import logger from '../utils/logger.js';

/**
 * Simple in-memory rate limiting
 * For production, use Redis-based rate limiting
 */
class InMemoryRateLimit {
  constructor() {
    this.requests = new Map();
    this.cleanup();
  }

  /**
   * Check if request is within rate limit
   */
  isAllowed(key, windowMs = 60000, maxRequests = 100) {
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const userRequests = this.requests.get(key);
    
    // Remove old requests outside the window
    const recentRequests = userRequests.filter(timestamp => timestamp > windowStart);
    this.requests.set(key, recentRequests);

    // Check if within limit
    if (recentRequests.length >= maxRequests) {
      return false;
    }

    // Add current request
    recentRequests.push(now);
    return true;
  }

  /**
   * Cleanup old entries periodically
   */
  cleanup() {
    setInterval(() => {
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);

      for (const [key, requests] of this.requests.entries()) {
        const recentRequests = requests.filter(timestamp => timestamp > oneHourAgo);
        if (recentRequests.length === 0) {
          this.requests.delete(key);
        } else {
          this.requests.set(key, recentRequests);
        }
      }
    }, 300000); // Cleanup every 5 minutes
  }
}

const rateLimiter = new InMemoryRateLimit();

/**
 * Rate limiting middleware factory
 */
export const rateLimit = (options = {}) => {
  const {
    windowMs = 60000,        // 1 minute
    maxRequests = 100,       // 100 requests per minute
    keyGenerator = (req) => req.ip || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    message = 'Too many requests, please try again later'
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    
    if (!rateLimiter.isAllowed(key, windowMs, maxRequests)) {
      logger.warn('Rate limit exceeded:', {
        key,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: message,
        timestamp: new Date().toISOString(),
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    next();
  };
};

// Pre-configured rate limiters
export const generalRateLimit = rateLimit({
  windowMs: 60000,    // 1 minute
  maxRequests: 100,   // 100 requests per minute
  message: 'Too many requests from this IP'
});

export const authRateLimit = rateLimit({
  windowMs: 300000,   // 5 minutes  
  maxRequests: 20,    // 20 auth attempts per 5 minutes
  message: 'Too many authentication attempts'
});

export const submitRateLimit = rateLimit({
  windowMs: 60000,    // 1 minute
  maxRequests: 10,    // 10 submissions per minute
  keyGenerator: (req) => `${req.ip}:${req.body?.tg_id || 'unknown'}`,
  message: 'Too many submissions, please wait'
});
