// =====================================================
// ENHANCED DATABASE CONFIGURATION - FIXED
// =====================================================
// File: src/config/database.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// ==================== ENVIRONMENT VALIDATION ====================

/**
 * Validate required environment variables
 */
if (!process.env.SUPABASE_URL) {
  console.error('❌ SUPABASE_URL environment variable is required');
  console.error('💡 Add it to your .env file: SUPABASE_URL=https://your-project.supabase.co');
  process.exit(1);
}

if (!process.env.SUPABASE_KEY) {
  console.error('❌ SUPABASE_KEY environment variable is required');
  console.error('💡 Add it to your .env file: SUPABASE_KEY=your-anon-key');
  process.exit(1);
}

// Validate URL format
try {
  new URL(process.env.SUPABASE_URL);
} catch (error) {
  console.error('❌ Invalid SUPABASE_URL format:', process.env.SUPABASE_URL);
  console.error('💡 Should be: https://your-project-ref.supabase.co');
  process.exit(1);
}

// ==================== SUPABASE CLIENT SETUP ====================

/**
 * Create Supabase client with optimized configuration
 */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    auth: {
      // Disable session persistence for API server
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    
    db: {
      // Use public schema
      schema: 'public'
    },
    
    realtime: {
      // Optimize realtime for API usage
      params: {
        eventsPerSecond: 10
      }
    },
    
    global: {
      headers: {
        'X-Client': 'yoldagilar-backend',
        'X-Version': '1.0.0'
      }
    }
  }
);

// ==================== CONNECTION TESTING ====================

/**
 * Test database connection
 * @returns {Promise<boolean>} Connection status
 */
export const testConnection = async () => {
  try {
    console.log('🔍 Testing database connection...');
    
    // Simple query to test connection
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') {
      console.error('❌ Database connection failed:', error.message);
      console.error('🔍 Error details:', error);
      return false;
    }

    console.log('✅ Database connection successful');
    return true;
    
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    console.error('🔍 Full error:', err);
    return false;
  }
};

/**
 * Get comprehensive database health information
 * @returns {Promise<Object>} Database health status
 */
export const getDatabaseHealth = async () => {
  try {
    const startTime = Date.now();
    
    // Test basic connection
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    const responseTime = Date.now() - startTime;
    
    if (error && error.code !== 'PGRST116') {
      return {
        status: 'error',
        error: error.message,
        error_code: error.code || 'unknown',
        response_time: responseTime,
        timestamp: new Date().toISOString(),
        connection: 'failed'
      };
    }

    // Additional health checks
    const healthData = {
      status: 'connected',
      response_time: responseTime,
      timestamp: new Date().toISOString(),
      connection: 'successful',
      
      // Performance assessment
      performance: responseTime < 200 ? 'excellent' : 
                  responseTime < 500 ? 'good' : 
                  responseTime < 1000 ? 'slow' : 'critical',
      
      // Database information
      database: {
        provider: 'Supabase',
        type: 'PostgreSQL',
        url: process.env.SUPABASE_URL?.substring(0, 50) + '...',
        optimized: true
      }
    };

    // Test table accessibility
    try {
      const { count: userCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      
      const { count: progressCount } = await supabase
        .from('daily_progress')
        .select('*', { count: 'exact', head: true });
        
      healthData.tables = {
        users: 'accessible',
        daily_progress: 'accessible',
        user_count: userCount || 0,
        progress_count: progressCount || 0
      };
      
    } catch (tableError) {
      healthData.tables = {
        status: 'error',
        error: tableError.message,
        note: 'Tables may not exist yet - run schema.sql'
      };
    }

    return healthData;
    
  } catch (err) {
    return {
      status: 'error',
      error: err.message,
      timestamp: new Date().toISOString(),
      connection: 'failed',
      suggestion: 'Check SUPABASE_URL and SUPABASE_KEY environment variables'
    };
  }
};

// ==================== QUERY OPTIMIZATION HELPERS ====================

/**
 * Execute query with performance monitoring
 * @param {Function} queryFunction - Supabase query function
 * @param {string} operationName - Name for logging
 * @returns {Promise<Object>} Query result with performance metrics
 */
export const executeQuery = async (queryFunction, operationName = 'Unknown') => {
  const startTime = Date.now();
  
  try {
    const result = await queryFunction();
    const executionTime = Date.now() - startTime;
    
    // Log slow queries in development
    if (process.env.NODE_ENV !== 'production' && executionTime > 1000) {
      console.warn(`⚠️ Slow query detected: ${operationName} took ${executionTime}ms`);
    }
    
    return {
      ...result,
      performance: {
        execution_time: executionTime,
        operation: operationName,
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`❌ Query failed: ${operationName} (${executionTime}ms)`, error);
    throw error;
  }
};

/**
 * Get database statistics for monitoring
 * @returns {Promise<Object>} Database statistics
 */
export const getDatabaseStats = async () => {
  try {
    const stats = {};
    
    // Get user count
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    // Get approved users count
    const { count: approvedCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_approved', true);
    
    // Get today's active users
    const today = new Date().toISOString().split('T')[0];
    const { count: todayActiveCount } = await supabase
      .from('daily_progress')
      .select('*', { count: 'exact', head: true })
      .eq('date', today);
    
    // Get total progress entries
    const { count: totalProgressCount } = await supabase
      .from('daily_progress')
      .select('*', { count: 'exact', head: true });
    
    return {
      users: {
        total: userCount || 0,
        approved: approvedCount || 0,
        pending_approval: (userCount || 0) - (approvedCount || 0)
      },
      activity: {
        today_active: todayActiveCount || 0,
        total_progress_entries: totalProgressCount || 0
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error getting database stats:', error);
    return {
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// ==================== CONNECTION MONITORING ====================

/**
 * Monitor database connection health
 * Useful for production monitoring
 */
export const startConnectionMonitoring = () => {
  if (process.env.NODE_ENV === 'production') {
    // Check connection every 5 minutes in production
    setInterval(async () => {
      const health = await getDatabaseHealth();
      
      if (health.status !== 'connected') {
        console.error('❌ Database health check failed:', health);
      } else if (health.response_time > 1000) {
        console.warn('⚠️ Database response time is slow:', health.response_time + 'ms');
      }
      
    }, 5 * 60 * 1000); // 5 minutes
  }
};

// ==================== DATABASE UTILITIES ====================

/**
 * Safely execute database operation with retry logic
 * @param {Function} operation - Database operation function
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} delay - Delay between retries (ms)
 * @returns {Promise<any>} Operation result
 */
export const executeWithRetry = async (operation, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        console.error(`❌ Database operation failed after ${maxRetries} attempts:`, error);
        throw error;
      }
      
      console.warn(`⚠️ Database operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Exponential backoff
      delay *= 2;
    }
  }
  
  throw lastError;
};

/**
 * Validate database schema exists
 * @returns {Promise<boolean>} Schema validation result
 */
export const validateSchema = async () => {
  try {
    console.log('🔍 Validating database schema...');
    
    // Check if required tables exist
    const requiredTables = ['users', 'daily_progress'];
    const tableChecks = [];
    
    for (const table of requiredTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
          
        if (error && error.code === 'PGRST106') {
          console.error(`❌ Table '${table}' does not exist`);
          tableChecks.push(false);
        } else {
          console.log(`✅ Table '${table}' exists`);
          tableChecks.push(true);
        }
      } catch (err) {
        console.error(`❌ Error checking table '${table}':`, err.message);
        tableChecks.push(false);
      }
    }
    
    // Check if user_statistics view exists
    try {
      const { data, error } = await supabase
        .from('user_statistics')
        .select('*')
        .limit(1);
        
      if (error && error.code === 'PGRST106') {
        console.error('❌ View "user_statistics" does not exist');
        tableChecks.push(false);
      } else {
        console.log('✅ View "user_statistics" exists');
        tableChecks.push(true);
      }
    } catch (err) {
      console.error('❌ Error checking view "user_statistics":', err.message);
      tableChecks.push(false);
    }
    
    const allTablesExist = tableChecks.every(check => check === true);
    
    if (!allTablesExist) {
      console.error('❌ Schema validation failed. Please run the schema.sql file in Supabase.');
      console.log('💡 Schema file should create: users table, daily_progress table, user_statistics view');
    } else {
      console.log('✅ Database schema validation successful');
    }
    
    return allTablesExist;
    
  } catch (error) {
    console.error('❌ Schema validation error:', error);
    return false;
  }
};

// ==================== STARTUP INITIALIZATION ====================

/**
 * Initialize database connection and validate setup
 * Call this during application startup
 */
export const initializeDatabase = async () => {
  try {
    console.log('🚀 Initializing database connection...');
    
    // Test basic connection
    const connectionOk = await testConnection();
    if (!connectionOk) {
      throw new Error('Database connection failed');
    }
    
    // Validate schema
    const schemaOk = await validateSchema();
    if (!schemaOk) {
      console.warn('⚠️ Schema validation failed, but continuing...');
      console.log('💡 Make sure to run schema.sql in your Supabase dashboard');
    }
    
    // Start monitoring in production
    if (process.env.NODE_ENV === 'production') {
      startConnectionMonitoring();
    }
    
    console.log('✅ Database initialization complete');
    return true;
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

// ==================== EXPORTS ====================

export default supabase;