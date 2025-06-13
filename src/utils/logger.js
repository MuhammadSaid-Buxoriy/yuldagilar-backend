/**
 * Log levels
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

/**
 * Get current log level from environment
 */
const getCurrentLogLevel = () => {
  const logLevel = process.env.LOG_LEVEL || 'info';
  return LOG_LEVELS[logLevel] || LOG_LEVELS.info;
};

/**
 * Get current environment
 */
const getCurrentEnvironment = () => {
  return process.env.NODE_ENV || 'development';
};

/**
 * Format log message
 */
function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...meta
  };

  // In development, use pretty printing
  if (getCurrentEnvironment() === 'development') {
    const metaStr = Object.keys(meta).length > 0 ? 
      `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  // In production, use JSON format
  return JSON.stringify(logEntry);
}

/**
 * Logger class
 */
class Logger {
  constructor() {
    this.currentLogLevel = getCurrentLogLevel();
  }

  error(message, meta = {}) {
    if (this.currentLogLevel >= LOG_LEVELS.error) {
      console.error(formatMessage('error', message, meta));
    }
  }

  warn(message, meta = {}) {
    if (this.currentLogLevel >= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', message, meta));
    }
  }

  info(message, meta = {}) {
    if (this.currentLogLevel >= LOG_LEVELS.info) {
      console.log(formatMessage('info', message, meta));
    }
  }

  debug(message, meta = {}) {
    if (this.currentLogLevel >= LOG_LEVELS.debug) {
      console.log(formatMessage('debug', message, meta));
    }
  }

  // HTTP request logging
  request(req, res, duration = null) {
    const logData = {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      ...(duration && { duration: `${duration}ms` })
    };

    if (res.statusCode >= 400) {
      this.warn('HTTP Request', logData);
    } else {
      this.info('HTTP Request', logData);
    }
  }

  // Database operation logging
  database(operation, duration, error = null) {
    const logData = {
      operation,
      duration: `${duration}ms`,
      ...(error && { error: error.message })
    };

    if (error) {
      this.error('Database Operation Failed', logData);
    } else if (duration > 1000) {
      this.warn('Slow Database Operation', logData);
    } else {
      this.debug('Database Operation', logData);
    }
  }
}

export default new Logger();