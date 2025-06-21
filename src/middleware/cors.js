// =====================================
// File: src/middleware/cors.js
// =====================================

import cors from 'cors';
import { FRONTEND_URLS } from '../config/constants.js';

// ✅ Enhanced CORS Options
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // e.g., curl, mobile app

    const isDev = process.env.NODE_ENV === 'development';

    // ✅ Localhost yoki *.vercel.app va FRONTEND_URLS dan ruxsat
    if (
      FRONTEND_URLS.includes(origin) ||
      (isDev && origin.includes('localhost')) ||
      origin.includes('.vercel.app') ||
      origin.includes('.netlify.app') ||
      origin === 'https://t.me' ||
      origin === 'https://web.telegram.org'
    ) {
      return callback(null, true);
    }

    // ❌ Ruxsat berilmagan origin
    console.warn(`❌ CORS: Blocked origin: ${origin}`);
    return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
  },

  credentials: true,

  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],

  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Request-ID',
    'X-Timezone',
    'X-User-Agent',
    'X-Forwarded-For',
    'Cache-Control',
    'Pragma'
  ],

  exposedHeaders: [
    'X-Request-ID',
    'X-Response-Time',
    'X-Rate-Limit-Remaining',
    'X-Total-Count',
    'X-Server-Time'
  ],

  maxAge: 86400,
  optionsSuccessStatus: 200
};

// ✅ Middleware
export const corsMiddleware = cors(corsOptions);

// ✅ Preflight handler
export const handlePreflightOptions = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;

    const allowed = !origin ||
      FRONTEND_URLS.includes(origin) ||
      origin.includes('localhost') ||
      origin.includes('.vercel.app') ||
      origin.includes('.netlify.app') ||
      origin === 'https://t.me' ||
      origin === 'https://web.telegram.org';

    if (allowed) {
      res.header('Access-Control-Allow-Origin', origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
      res.header('Access-Control-Allow-Headers',
        'Origin,X-Requested-With,Content-Type,Accept,Authorization,X-Request-ID,X-Timezone,X-User-Agent,X-Forwarded-For,Cache-Control,Pragma'
      );
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Max-Age', '86400');
      return res.status(200).end();
    } else {
      console.warn(`❌ Preflight Blocked: ${origin}`);
      return res.status(403).json({
        success: false,
        error: 'CORS Preflight failed',
        origin,
        timestamp: new Date().toISOString()
      });
    }
  }
  next();
};

// ✅ Debug middleware
export const debugCors = (req, res, next) => {
  if (process.env.NODE_ENV === 'development' && req.method !== 'OPTIONS') {
    console.log('🧪 CORS Debug:', {
      origin: req.headers.origin,
      method: req.method,
      path: req.path,
      headers: req.headers,
    });
    res.header('X-CORS-Debug', 'true');
  }
  next();
};

// ✅ Error handler
export const corsErrorHandler = (error, req, res, next) => {
  if (error && error.message && error.message.includes('CORS')) {
    console.error('🚨 CORS Error:', {
      message: error.message,
      origin: req.headers.origin,
      method: req.method,
      url: req.url
    });

    return res.status(403).json({
      success: false,
      error: 'CORS Policy Violation',
      message: error.message,
      origin: req.headers.origin,
      timestamp: new Date().toISOString()
    });
  }

  next(error);
};

// ✅ Get current config
export const getCorsConfig = () => ({
  environment: process.env.NODE_ENV,
  frontend_urls: FRONTEND_URLS,
  additional_allowed: [
    'localhost:*',
    '*.vercel.app',
    '*.netlify.app',
    't.me',
    'web.telegram.org'
  ],
  credentials: true,
  methods: corsOptions.methods,
  max_age: corsOptions.maxAge
});

// Export all
export default {
  corsMiddleware,
  handlePreflightOptions,
  debugCors,
  corsErrorHandler,
  getCorsConfig
};
