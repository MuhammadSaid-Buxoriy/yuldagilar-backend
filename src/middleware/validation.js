// =====================================================
// VALIDATION MIDDLEWARE - Enhanced for All Endpoints
// =====================================================
import Joi from 'joi';
import logger from '../utils/logger.js';

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

export const schemas = {
  // User registration validation
  registerUser: Joi.object({
    tg_id: Joi.number().integer().positive().required()
      .messages({
        'number.base': 'Telegram ID must be a number',
        'number.positive': 'Telegram ID must be positive',
        'any.required': 'Telegram ID is required'
      }),
    name: Joi.string().min(2).max(200).trim().required()
      .pattern(/^[a-zA-ZА-Яа-яЁёЎўҚқҒғҲҳ\s'.-]+$/)
      .messages({
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name cannot exceed 200 characters',
        'string.pattern.base': 'Name contains invalid characters',
        'any.required': 'Name is required'
      }),
    username: Joi.string().alphanum().min(3).max(50).optional().allow(null),
    photo_url: Joi.string().uri().optional().allow(null)
  }),

  // Auth check validation - Frontend sends { userId }
  authCheck: Joi.object({
    userId: Joi.alternatives()
      .try(
        Joi.number().integer().positive(),
        Joi.string().pattern(/^\d+$/).custom((value) => parseInt(value))
      )
      .required()
      .messages({
        'any.required': 'userId is required',
        'alternatives.match': 'userId must be a valid number'
      })
  }),

  // ✅ FIXED: Daily progress validation - Enhanced
  dailyProgress: Joi.object({
    tg_id: Joi.number().integer().positive().required()
      .messages({
        'number.base': 'tg_id must be a number',
        'number.positive': 'tg_id must be positive',
        'any.required': 'tg_id is required'
      }),
    name: Joi.string().min(2).max(200).optional(),
    
    // All 10 tasks validation
    shart_1: Joi.number().integer().min(0).max(1).default(0),
    shart_2: Joi.number().integer().min(0).max(1).default(0),
    shart_3: Joi.number().integer().min(0).max(1).default(0),
    shart_4: Joi.number().integer().min(0).max(1).default(0),
    shart_5: Joi.number().integer().min(0).max(1).default(0),
    shart_6: Joi.number().integer().min(0).max(1).default(0),
    shart_7: Joi.number().integer().min(0).max(1).default(0),
    shart_8: Joi.number().integer().min(0).max(1).default(0),
    shart_9: Joi.number().integer().min(0).max(1).default(0),
    shart_10: Joi.number().integer().min(0).max(1).default(0),
    
    // Additional metrics with proper validation
    pages_read: Joi.number().integer().min(0).max(10000).default(0)
      .messages({
        'number.min': 'pages_read cannot be negative',
        'number.max': 'pages_read cannot exceed 10000'
      }),
    distance_km: Joi.number().min(0).max(1000).precision(2).default(0)
      .messages({
        'number.min': 'distance_km cannot be negative',
        'number.max': 'distance_km cannot exceed 1000'
      })
  }),

  // ✅ Enhanced leaderboard query validation
  leaderboardQuery: Joi.object({
    period: Joi.string().valid('daily', 'weekly', 'all_time', 'all').default('weekly')
      .messages({
        'any.only': 'period must be one of: daily, weekly, all_time, all'
      }),
    type: Joi.string().valid('overall', 'reading', 'distance').default('overall')
      .messages({
        'any.only': 'type must be one of: overall, reading, distance'
      }),
    limit: Joi.number().integer().min(1).max(500).default(100)
      .messages({
        'number.min': 'limit must be at least 1',
        'number.max': 'limit cannot exceed 500'
      }),
    offset: Joi.number().integer().min(0).default(0)
      .messages({
        'number.min': 'offset cannot be negative'
      }),
    tg_id: Joi.number().integer().positive().optional()
  }),

  // User ID parameter validation (for URLs like /users/:userId)
  userIdParam: Joi.object({
    userId: Joi.alternatives()
      .try(
        Joi.number().integer().positive(),
        Joi.string().pattern(/^\d+$/).custom((value) => parseInt(value))
      )
      .required()
      .messages({
        'any.required': 'userId parameter is required',
        'alternatives.match': 'userId must be a valid positive number'
      })
  }),

  // ✅ NEW: Date parameter validation
  dateParam: Joi.object({
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
      .messages({
        'string.pattern.base': 'date must be in YYYY-MM-DD format',
        'any.required': 'date parameter is required'
      })
  }),

  // ✅ NEW: History query validation
  historyQuery: Joi.object({
    days: Joi.number().integer().min(1).max(365).default(30)
      .messages({
        'number.min': 'days must be at least 1',
        'number.max': 'days cannot exceed 365'
      })
  }),

  // ✅ NEW: Telegram ID parameter validation (for admin routes)
  telegramIdParam: Joi.object({
    tg_id: Joi.number().integer().positive().required()
      .messages({
        'number.base': 'tg_id must be a number',
        'number.positive': 'tg_id must be positive',
        'any.required': 'tg_id parameter is required'
      })
  })
};

// =====================================================
// VALIDATION MIDDLEWARE FACTORY
// =====================================================

/**
 * Generic validation middleware factory
 */
export const validate = (schema, target = 'body') => {
  return (req, res, next) => {
    const dataToValidate = target === 'query' ? req.query : 
                          target === 'params' ? req.params : 
                          target === 'body' ? req.body : req.body;

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
      convert: true
    });

    if (error) {
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
        type: detail.type
      }));

      logger.warn('Validation error:', { 
        path: req.path, 
        method: req.method, 
        target: target,
        errors: errorMessages,
        originalData: dataToValidate
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Please check your input data',
        details: errorMessages,
        timestamp: new Date().toISOString(),
        help: 'Check the API documentation for correct data formats'
      });
    }

    // Replace original data with validated/sanitized data
    if (target === 'query') {
      req.query = value;
    } else if (target === 'params') {
      req.params = { ...req.params, ...value };
    } else {
      req.body = value;
    }

    next();
  };
};

// =====================================================
// PRE-BUILT VALIDATION MIDDLEWARES
// =====================================================

// Auth validations
export const validateAuthCheck = validate(schemas.authCheck);
export const validateRegisterUser = validate(schemas.registerUser);

// Task validations
export const validateDailyProgress = validate(schemas.dailyProgress);

// User validations
export const validateUserIdParam = validate(schemas.userIdParam, 'params');

// Leaderboard validations
export const validateLeaderboardQuery = validate(schemas.leaderboardQuery, 'query');

// ✅ NEW: Additional parameter validations
export const validateDateParam = validate(schemas.dateParam, 'params');
export const validateHistoryQuery = validate(schemas.historyQuery, 'query');
export const validateTelegramIdParam = validate(schemas.telegramIdParam, 'params');

// ✅ NEW: Combined validations for complex routes
export const validateUserProgress = [
  validate(schemas.userIdParam, 'params'),
  validate(schemas.dateParam, 'params')
];

export const validateUserHistory = [
  validate(schemas.userIdParam, 'params'),
  validate(schemas.historyQuery, 'query')
];

// =====================================================
// CUSTOM VALIDATION HELPERS
// =====================================================

/**
 * Validate Telegram user data from bot
 */
export const validateTelegramUser = (req, res, next) => {
  const { tg_id, first_name, last_name, username } = req.body;
  
  if (!tg_id || !first_name) {
    return res.status(400).json({
      success: false,
      error: 'Missing required Telegram user data',
      message: 'tg_id and first_name are required',
      required_fields: ['tg_id', 'first_name'],
      optional_fields: ['last_name', 'username', 'photo_url']
    });
  }

  // Construct full name
  const fullName = [first_name, last_name].filter(Boolean).join(' ');
  req.body.name = fullName;

  next();
};

/**
 * Validate date range
 */
export const validateDateRange = (maxDays = 365) => {
  return (req, res, next) => {
    const { start_date, end_date } = req.query;
    
    if (start_date && end_date) {
      const start = new Date(start_date);
      const end = new Date(end_date);
      const diffDays = (end - start) / (1000 * 60 * 60 * 24);
      
      if (diffDays > maxDays) {
        return res.status(400).json({
          success: false,
          error: 'Date range too large',
          message: `Date range cannot exceed ${maxDays} days`,
          max_days: maxDays,
          requested_days: Math.ceil(diffDays)
        });
      }
    }
    
    next();
  };
};