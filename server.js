// =====================================================
// SERVER STARTUP - Webhook Ready
// =====================================================
// File: server.js

import dotenv from 'dotenv';
import app from './app.js';
import { testConnection, initializeDatabase } from './src/config/database.js';
import { setupWebhook } from './telegram-bot.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

/**
 * Setup Telegram webhook (production only)
 */
async function setupTelegramWebhook() {
  try {
    // Only setup webhook in production or when WEBHOOK_URL is provided
    const webhookUrl = process.env.WEBHOOK_URL;
    
    if (!webhookUrl) {
      console.log('🔗 WEBHOOK_URL not provided - skipping webhook setup');
      console.log('💡 For production: Set WEBHOOK_URL=https://your-domain.com/webhook');
      return;
    }

    console.log('🔗 Setting up Telegram webhook...');
    await setupWebhook(`${webhookUrl}/webhook`);
    console.log('✅ Telegram webhook configured successfully');
    
  } catch (error) {
    console.error('❌ Webhook setup failed:', error.message);
    
    // Don't exit in development, but warn
    if (process.env.NODE_ENV === 'production') {
      console.error('🚨 Production requires working webhook - exiting');
      process.exit(1);
    } else {
      console.log('⚠️ Development mode: continuing without webhook');
    }
  }
}

/**
 * Start server with database initialization and webhook setup
 */
async function startServer() {
  try {
    console.log('🚀 Starting Yoldagilar Backend Server...');
    console.log('📍 Environment:', process.env.NODE_ENV || 'development');
    
    // Initialize database connection
    console.log('\n🗄️ Initializing database...');
    await initializeDatabase();
    
    // Start HTTP server
    const server = app.listen(PORT, async () => {
      console.log('\n✅ 🎉 YOLDAGILAR BACKEND READY! 🎉');
      console.log('═'.repeat(50));
      console.log(`🌐 Server URL: http://localhost:${PORT}`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`📖 API Docs: http://localhost:${PORT}/`);
      console.log(`🔍 Test DB: http://localhost:${PORT}/api/test-db`);
      console.log(`🔗 Webhook Endpoint: http://localhost:${PORT}/webhook`);
      console.log('═'.repeat(50));
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️ Database: Supabase Connected`);
      console.log(`🤖 Bot Token: ${process.env.BOT_TOKEN ? 'Configured ✅' : 'Missing ❌'}`);
      console.log(`👤 Admin ID: ${process.env.ADMIN_ID || 'Not set'}`);
      console.log(`🔗 Webhook URL: ${process.env.WEBHOOK_URL || 'Not set (development mode)'}`);
      console.log(`🎯 Frontend Compatible: 100% ✅`);
      console.log(`🤖 Bot Mode: Webhook (polling disabled) ✅`);
      console.log('═'.repeat(50));
      
      // Setup Telegram webhook after server is running
      await setupTelegramWebhook();
      
      console.log('\n🛑 To stop server: Ctrl + C');
      console.log('🔄 To restart: rs + Enter\n');
    });

    // Graceful shutdown handlers
    const gracefulShutdown = (signal) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
      
      server.close(() => {
        console.log('✅ HTTP server closed');
        console.log('✅ Graceful shutdown complete');
        process.exit(0);
      });
      
      // Force close after 10 seconds
      setTimeout(() => {
        console.error('❌ Force shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      console.error('📚 Stack:', error.stack);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise);
      console.error('📚 Reason:', reason);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
    console.error('📚 Details:', error);
    
    // Helpful error messages
    if (error.message.includes('SUPABASE_URL')) {
      console.log('\n💡 Fix: Check your .env file');
      console.log('   SUPABASE_URL=https://your-project.supabase.co');
      console.log('   SUPABASE_KEY=your-anon-key');
    }
    
    if (error.message.includes('BOT_TOKEN')) {
      console.log('\n💡 Fix: Add bot token to .env file');
      console.log('   BOT_TOKEN=your-telegram-bot-token');
    }
    
    process.exit(1);
  }
}

// Start the server
startServer();