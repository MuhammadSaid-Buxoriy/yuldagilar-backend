// =====================================================
// SERVER STARTUP - Polling Mode Ready
// =====================================================
// File: server.js

import dotenv from 'dotenv';
import app from './app.js';
import { testConnection, initializeDatabase } from './src/config/database.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

/**
 * Start server with database initialization
 * Bot runs separately in polling mode
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
      console.log('═'.repeat(50));
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️ Database: Supabase Connected`);
      console.log(`🤖 Bot Token: ${process.env.BOT_TOKEN ? 'Configured ✅' : 'Missing ❌'}`);
      console.log(`👤 Admin ID: ${process.env.ADMIN_ID || 'Not set'}`);
      console.log(`🎯 Frontend Compatible: 100% ✅`);
      console.log(`🤖 Bot Mode: Polling (separate process) ✅`);
      console.log('═'.repeat(50));
      
      // Bot startup instructions
      console.log('\n🤖 TELEGRAM BOT INSTRUCTIONS:');
      console.log('📝 The bot runs as a separate process in polling mode');
      console.log('🚀 To start bot: node telegram-bot.js');
      console.log('🔄 Or use PM2: pm2 start telegram-bot.js --name "yoldagilar-bot"');
      console.log('📋 Bot and server can run independently');
      console.log('💡 No webhook setup required for polling mode');
      
      console.log('\n🛑 To stop server: Ctrl + C');
      console.log('🔄 To restart: rs + Enter\n');
    });

    // Graceful shutdown handlers
    const gracefulShutdown = (signal) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
      
      server.close(() => {
        console.log('✅ HTTP server closed');
        console.log('✅ Graceful shutdown complete');
        console.log('💡 Note: Stop bot separately if running');
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
      console.log('   ADMIN_ID=your-telegram-id');
    }
    
    process.exit(1);
  }
}

// Start the server
startServer();