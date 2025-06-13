import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Validate required environment variables
 */
function validateEnvironment() {
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_KEY'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Validate URLs
  if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.startsWith('https://')) {
    throw new Error('SUPABASE_URL must be a valid HTTPS URL');
  }

  console.log('✅ Environment validation passed');
}

/**
 * Get environment configuration with defaults
 */
export function getEnvironmentConfig() {
  validateEnvironment();

  return {
    // Server configuration
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT) || 3000,
    
    // Database configuration
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    
    // Telegram configuration
    BOT_TOKEN: process.env.BOT_TOKEN || null,
    ADMIN_ID: process.env.ADMIN_ID ? parseInt(process.env.ADMIN_ID) : null,
    
    // Frontend configuration
    FRONTEND_URL: process.env.FRONTEND_URL || 'https://yuldagilar.vercel.app',
    
    // Security configuration
    JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-key',
    API_RATE_LIMIT: parseInt(process.env.API_RATE_LIMIT) || 100,
    
    // Logging configuration
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    
    // Feature flags
    ENABLE_RATE_LIMITING: process.env.ENABLE_RATE_LIMITING !== 'false',
    ENABLE_REQUEST_LOGGING: process.env.ENABLE_REQUEST_LOGGING !== 'false',
    ENABLE_ACHIEVEMENT_SYSTEM: process.env.ENABLE_ACHIEVEMENT_SYSTEM !== 'false'
  };
}

// Export validated config
export const config = getEnvironmentConfig();