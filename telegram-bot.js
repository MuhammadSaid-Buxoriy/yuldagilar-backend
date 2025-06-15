// =====================================================
// TELEGRAM BOT - Pure Polling Mode (Server Compatible)
// =====================================================
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';

// Load environment variables
dotenv.config();

// Validate environment
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN environment variable not found!');
  process.exit(1);
}

if (!process.env.ADMIN_ID) {
  console.error('❌ ADMIN_ID environment variable not found!');
  process.exit(1);
}

// Configuration
const CONFIG = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  ADMIN_ID: parseInt(process.env.ADMIN_ID),
  MINI_APP_URL: process.env.MINI_APP_URL || 'https://yuldagilar.vercel.app',
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000/api',
  SESSION_TTL: 30 * 60 * 1000, // 30 minutes
  POLLING_INTERVAL: 2000, // 2 seconds
  POLLING_TIMEOUT: 30 // 30 seconds
};

// ==================== WEBHOOK CLEANUP FUNCTION ====================

async function cleanupWebhook() {
  console.log('🔄 Cleaning up any existing webhooks...');
  
  try {
    // Create temporary bot instance for cleanup
    const tempBot = new TelegramBot(CONFIG.BOT_TOKEN, { polling: false });
    
    // Get webhook info first
    const webhookInfo = await tempBot.getWebHookInfo();
    console.log('📡 Current webhook info:', webhookInfo);
    
    // Delete webhook if exists
    const deleteResult = await tempBot.deleteWebHook({ drop_pending_updates: true });
    console.log('🗑️ Webhook deletion result:', deleteResult);
    
    // Wait a bit to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('✅ Webhook cleanup completed');
    
  } catch (error) {
    console.log('⚠️ Webhook cleanup error (this is usually OK):', error.message);
  }
}

// ==================== BOT INSTANCE CREATION ====================

let bot;

async function createBot() {
  try {
    // First cleanup any webhooks
    await cleanupWebhook();
    
    // Create bot with polling
    bot = new TelegramBot(CONFIG.BOT_TOKEN, { 
      polling: {
        interval: CONFIG.POLLING_INTERVAL,
        autoStart: false, // Don't start automatically
        params: {
          timeout: CONFIG.POLLING_TIMEOUT,
          allowed_updates: ['message', 'callback_query', 'web_app_data']
        }
      }
    });

    console.log('🤖 Bot instance created');
    
    // Test bot connection
    const botInfo = await bot.getMe();
    console.log(`✅ Bot connected: @${botInfo.username} (ID: ${botInfo.id})`);
    
    // Start polling manually
    await bot.startPolling({
      restart: true // Restart polling if it stops
    });
    
    console.log('🔄 Polling started successfully');
    
    return bot;
    
  } catch (error) {
    console.error('❌ Failed to create bot:', error.message);
    throw error;
  }
}

// Temporary user sessions
const userSessions = new Map();

// ==================== API INTEGRATION ====================

/**
 * Make API request to backend
 */
async function makeAPIRequest(endpoint, options = {}) {
  try {
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;
    
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    };

    const requestOptions = { ...defaultOptions, ...options };
    
    if (requestOptions.body && typeof requestOptions.body === 'object') {
      requestOptions.body = JSON.stringify(requestOptions.body);
    }

    console.log(`🌐 API Request: ${requestOptions.method} ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestOptions.timeout);
    
    const response = await fetch(url, {
      ...requestOptions,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`📡 API Response [${response.status}]:`, result.success ? '✅' : '❌', result.message);
    
    return result;
  } catch (error) {
    console.error('❌ API request error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Check user registration status via API
 */
async function checkUserRegistration(tgId) {
  const response = await makeAPIRequest(`/auth/check`, {
    method: 'POST',
    body: { userId: tgId }
  });
  return response;
}

/**
 * Register user via API
 */
async function registerUser(userData) {
  const response = await makeAPIRequest('/auth/register', {
    method: 'POST',
    body: userData
  });
  return response;
}

/**
 * Approve user via API
 */
async function approveUser(tgId) {
  const response = await makeAPIRequest(`/auth/approve/${tgId}`, {
    method: 'POST'
  });
  return response;
}

/**
 * Reject user via API
 */
async function rejectUser(tgId) {
  const response = await makeAPIRequest(`/auth/reject/${tgId}`, {
    method: 'POST'
  });
  return response;
}

/**
 * Get user profile photo URL
 */
async function getUserProfilePhoto(userId) {
  try {
    console.log(`🔍 Getting profile photo for user ${userId}...`);
    
    const photos = await bot.getUserProfilePhotos(userId, { limit: 1 });
    
    if (photos.photos && photos.photos.length > 0) {
      const fileId = photos.photos[0][0].file_id;
      const file = await bot.getFile(fileId);
      const photoUrl = `https://api.telegram.org/file/bot${CONFIG.BOT_TOKEN}/${file.file_path}`;
      
      console.log(`✅ Profile photo found for user ${userId}`);
      return photoUrl;
    } else {
      console.log(`ℹ️ No profile photo found for user ${userId}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Failed to get profile photo for user ${userId}:`, error.message);
    return null;
  }
}

/**
 * Update user photo in API
 */
async function updateUserPhotoInAPI(tgId, photoUrl) {
  try {
    const response = await makeAPIRequest(`/auth/update-photo/${tgId}`, {
      method: 'PUT',
      body: { photo_url: photoUrl }
    });
    
    console.log(`✅ Photo updated in API for user ${tgId}:`, response.success);
    return response.success;
  } catch (error) {
    console.error(`❌ Failed to update photo in API for user ${tgId}:`, error);
    return false;
  }
}

/**
 * Clean old sessions
 */
function cleanOldSessions() {
  const now = Date.now();
  const oldCount = userSessions.size;
  
  for (const [userId, session] of userSessions.entries()) {
    if (now - session.timestamp > CONFIG.SESSION_TTL) {
      userSessions.delete(userId);
    }
  }
  
  const newCount = userSessions.size;
  if (oldCount > newCount) {
    console.log(`🧹 Cleaned ${oldCount - newCount} old sessions`);
  }
}

// ==================== BOT MESSAGE HANDLERS ====================

function setupBotHandlers() {
  /**
   * Start command
   */
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';
    const username = msg.from.username || null;

    console.log(`👤 /start: ${firstName} ${lastName} (@${username}) - ID: ${userId}`);

    try {
      const authStatus = await checkUserRegistration(userId);

      if (!authStatus.success) {
        await bot.sendMessage(chatId, 
          `❌ Xatolik yuz berdi. Iltimos, biroz kutib qaytadan urinib ko'ring.\n` +
          `📞 Muammo davom etsa: @muhammadsaid_buxoriy`
        );
        return;
      }

      if (authStatus.isRegistered && authStatus.isApproved) {
        // Update profile photo
        console.log('🔄 Checking for profile photo update...');
        const currentPhotoUrl = await getUserProfilePhoto(userId);
        
        if (currentPhotoUrl) {
          await updateUserPhotoInAPI(userId, currentPhotoUrl);
        }

        await bot.sendMessage(chatId, 
          `✅ Xush kelibsiz, ${authStatus.user.name}!\n\n` +
          `🚀 Challenge'ni boshlash uchun Mini App'ni oching.\n` +
          `💪 Har kun 10 ta vazifani bajarib, o'z natijangizni kuzatib boring!`, 
          {
            reply_markup: {
              inline_keyboard: [[
                { 
                  text: "🚀 Mini App'ni ochish", 
                  web_app: { url: CONFIG.MINI_APP_URL } 
                }
              ]]
            }
          }
        );
        return;
      }

      if (authStatus.isRegistered && !authStatus.isApproved) {
        await bot.sendMessage(chatId, 
          `⏳ So'rovingiz admin tomonidan ko'rib chiqilmoqda.\n\n` +
          `📞 Savollar uchun: @muhammadsaid_buxoriy\n` +
          `⏱️ Odatda 24 soat ichida javob beramiz.`
        );
        return;
      }

      // Start registration
      await bot.sendMessage(chatId, 
        `👋 Assalomu alaykum, ${firstName}!\n\n` +
        `🎯 Challenge'da qatnashish uchun to'liq ism-familiyangizni yozing.\n\n` +
        `📝 Misol: Muhammad Said Seitmuradov\n` +
        `⚠️ Iltimos, haqiqiy ismingizni yozing.\n\n` +
        `ℹ️ Sizning ma'lumotlaringiz faqat challenge uchun ishlatiladi.`
      );

      userSessions.set(userId, {
        step: 'awaiting_name',
        firstName,
        lastName,
        username,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Start command error:', error);
      await bot.sendMessage(chatId, 
        `❌ Xatolik yuz berdi. Iltimos, biroz kutib qaytadan urinib ko'ring.\n` +
        `📞 Muammo davom etsa: @muhammadsaid_buxoriy`
      );
    }
  });

  /**
   * Update photo command
   */
  bot.onText(/\/update_photo/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
      console.log(`🔄 Manual photo update requested by user ${userId}`);

      const authStatus = await checkUserRegistration(userId);
      
      if (!authStatus.success || !authStatus.isRegistered || !authStatus.isApproved) {
        await bot.sendMessage(chatId, 
          `❌ Avval ro'yxatdan o'ting va tasdiqlashni kuting.`
        );
        return;
      }

      const photoUrl = await getUserProfilePhoto(userId);
      
      if (photoUrl) {
        const updateResult = await updateUserPhotoInAPI(userId, photoUrl);
        
        if (updateResult) {
          await bot.sendMessage(chatId, 
            `✅ Profil rasmingiz muvaffaqiyatli yangilandi!\n` +
            `🔄 Mini App'ni qayta oching - yangi rasmingiz ko'rinadi.`
          );
        } else {
          await bot.sendMessage(chatId, 
            `❌ Rasmni yangilashda xatolik yuz berdi. Keyinroq qaytadan urinib ko'ring.`
          );
        }
      } else {
        await bot.sendMessage(chatId, 
          `ℹ️ Telegram profilingizda rasm yo'q.\n` +
          `📸 Avval Telegram profilingizga rasm qo'ying, keyin qaytadan urinib ko'ring.`
        );
      }

    } catch (error) {
      console.error('Update photo command error:', error);
      await bot.sendMessage(chatId, 
        `❌ Rasmni yangilashda xatolik yuz berdi.`
      );
    }
  });

  /**
   * Handle registration messages
   */
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    if (!text || text.startsWith('/') || msg.web_app_data) {
      return;
    }

    const session = userSessions.get(userId);
    
    if (!session || session.step !== 'awaiting_name') {
      return;
    }

    try {
      const name = text.trim();
      
      if (name.length < 2) {
        await bot.sendMessage(chatId, 
          `❌ Ism juda qisqa. Kamida 2 ta harf bo'lishi kerak.`
        );
        return;
      }

      if (name.length > 200) {
        await bot.sendMessage(chatId, 
          `❌ Ism juda uzun. 200 ta harfdan oshmasligi kerak.`
        );
        return;
      }

      const nameRegex = /^[a-zA-ZА-Яа-яЁёЎўҚқҒғҲҳ\s'.-]+$/;
      if (!nameRegex.test(name)) {
        await bot.sendMessage(chatId, 
          `❌ Iltimos, faqat harflar va probel ishlatib ism-familiyangizni yozing.`
        );
        return;
      }

      const words = name.split(/\s+/).filter(w => w.length > 0);
      if (words.length < 2) {
        await bot.sendMessage(chatId, 
          `❌ Iltimos, ism va familiyangizni to'liq yozing.`
        );
        return;
      }

      console.log(`📝 Registration attempt: ${name} (${userId})`);

      const photoUrl = await getUserProfilePhoto(userId);

      const registrationData = {
        tg_id: userId,
        name: name,
        username: session.username,
        photo_url: photoUrl
      };

      const registrationResult = await registerUser(registrationData);

      if (registrationResult.success) {
        await bot.sendMessage(chatId, 
          `✅ Arizangiz muvaffaqiyatli yuborildi!\n\n` +
          `⏳ Admin tasdiqlashini kuting (odatda 24 soat ichida).\n` +
          `📱 Tasdiqlangandan so'ng sizga Mini App'ga kirish uchun xabar beramiz.\n\n` +
          `📞 Savollar uchun: @muhammadsaid_buxoriy`
        );

        const adminMessage = 
          `🆕 Yangi challenge ishtirokchisi!\n\n` +
          `👤 Ismi: ${name}\n` +
          `🆔 Telegram ID: ${userId}\n` +
          `👨‍💻 Username: ${session.username ? '@' + session.username : '❌ Yo\'q'}\n` +
          `📅 Vaqt: ${new Date().toLocaleString('uz-UZ', {
            timeZone: 'Asia/Tashkent'
          })}\n\n` +
          `💡 Bu foydalanuvchini qabul qilasizmi?`;

        const adminButtons = {
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Qabul qilish", callback_data: `approve_${userId}` },
              { text: "❌ Rad etish", callback_data: `reject_${userId}` }
            ]]
          }
        };

        try {
          await bot.sendMessage(CONFIG.ADMIN_ID, adminMessage, adminButtons);
          console.log(`✅ Admin notification sent for user ${userId}`);
        } catch (adminError) {
          console.error('Failed to send admin notification:', adminError);
        }

        userSessions.delete(userId);

      } else {
        await bot.sendMessage(chatId, 
          `❌ Ro'yxatdan o'tishda xatolik yuz berdi.\n` +
          `📞 Iltimos, @muhammadsaid_buxoriy bilan bog'laning.\n\n` +
          `Xatolik: ${registrationResult.message || 'Noma\'lum xatolik'}`
        );
      }

    } catch (error) {
      console.error('Registration error:', error);
      await bot.sendMessage(chatId, 
        `❌ Kutilmagan xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.\n` +
        `📞 Muammo davom etsa: @muhammadsaid_buxoriy`
      );
    }
  });

  /**
   * Handle admin callback queries
   */
  bot.on('callback_query', async (query) => {
    const callbackData = query.data;
    const adminChatId = query.message.chat.id;
    const messageId = query.message.message_id;

    await bot.answerCallbackQuery(query.id);

    if (query.from.id !== CONFIG.ADMIN_ID) {
      await bot.answerCallbackQuery(query.id, {
        text: "❌ Sizda ruxsat yo'q!",
        show_alert: true
      });
      return;
    }

    try {
      if (callbackData.startsWith('approve_')) {
        const userId = parseInt(callbackData.split('_')[1]);
        console.log(`✅ Admin approved user: ${userId}`);

        const result = await approveUser(userId);

        if (result.success) {
          await bot.editMessageText(
            `✅ QABUL QILINDI!\n\n` +
            `🆔 User ID: ${userId}\n` +
            `👤 Ism: ${result.user?.name || 'N/A'}\n` +
            `📅 ${new Date().toLocaleString('uz-UZ', {
              timeZone: 'Asia/Tashkent'
            })}`, 
            {
              chat_id: adminChatId,
              message_id: messageId
            }
          );

          try {
            await bot.sendMessage(userId, 
              `🎉 Tabriklaymiz! Challenge'ga qabul qilindingiz!\n\n` +
              `🚀 Endi Mini App orqali kunlik vazifalarni bajarishingiz mumkin.\n` +
              `🎯 Har kun 10 ta vazifa, kitob o'qish va sport bilan shug'ullaning.\n` +
              `📊 Natijalaringizni kuzatib, boshqalar bilan raqobatlashing!\n\n` +
              `💪 Omad tilaymiz!`, 
              {
                reply_markup: {
                  inline_keyboard: [[
                    { 
                      text: "🚀 Mini App'ni ochish", 
                      web_app: { url: CONFIG.MINI_APP_URL } 
                    }
                  ]]
                }
              }
            );
          } catch (userError) {
            console.error(`Failed to notify approved user ${userId}:`, userError);
          }
        } else {
          await bot.editMessageText(
            `❌ Xatolik: ${result.message || 'Approve qilishda xatolik'}`, 
            {
              chat_id: adminChatId,
              message_id: messageId
            }
          );
        }

      } else if (callbackData.startsWith('reject_')) {
        const userId = parseInt(callbackData.split('_')[1]);
        console.log(`❌ Admin rejected user: ${userId}`);

        const result = await rejectUser(userId);

        if (result.success) {
          await bot.editMessageText(
            `🚫 RAD ETILDI!\n\n` +
            `🆔 User ID: ${userId}\n` +
            `📅 ${new Date().toLocaleString('uz-UZ', {
              timeZone: 'Asia/Tashkent'
            })}`, 
            {
              chat_id: adminChatId,
              message_id: messageId
            }
          );

          try {
            await bot.sendMessage(userId, 
              `❌ Kechirasiz, arizangiz rad etildi.\n\n` +
              `📋 Sabablari:\n` +
              `• To'liq ism kiritilmagan\n` +
              `• Noto'g'ri ma'lumot\n` +
              `• Boshqa texnik sabablar\n\n` +
              `🔄 Agar xatolik bo'lgan deb hisoblasangiz, qaytadan ariza berishingiz mumkin.\n` +
              `📞 Qo'shimcha ma'lumot: @muhammadsaid_buxoriy`
            );
          } catch (userError) {
            console.error(`Failed to notify rejected user ${userId}:`, userError);
          }
        } else {
          await bot.editMessageText(
            `❌ Xatolik: ${result.message || 'Reject qilishda xatolik'}`, 
            {
              chat_id: adminChatId,
              message_id: messageId
            }
          );
        }
      }

    } catch (error) {
      console.error('Callback query error:', error);
      try {
        await bot.editMessageText("❌ Xatolik yuz berdi!", {
          chat_id: adminChatId,
          message_id: messageId
        });
      } catch (editError) {
        console.error('Failed to edit message:', editError);
      }
    }
  });

  /**
   * Handle Web App data
   */
  bot.on('web_app_data', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    console.log(`🎮 Web App data received from user ${userId}`);
    
    const authStatus = await checkUserRegistration(userId);
    
    if (authStatus.success && authStatus.isRegistered && authStatus.isApproved) {
      await bot.sendMessage(chatId, 
        `✅ Mini App'dan ma'lumot olindi!\n` +
        `📊 Natijalaringiz saqlandi.`
      );
    } else {
      await bot.sendMessage(chatId, 
        `⚠️ Mini App'dan foydalanish uchun avval ro'yxatdan o'ting.\n` +
        `/start buyrug'ini bajaring.`
      );
    }
  });

  // ==================== ERROR HANDLING ====================

  bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error.message || error);
    
    // Auto-restart on conflict
    if (error.code === 'ETELEGRAM' && error.response?.statusCode === 409) {
      console.log('🔄 Conflict detected, restarting...');
      setTimeout(() => {
        process.exit(1);
      }, 5000);
    }
  });

  bot.on('error', (error) => {
    console.error('❌ Bot error:', error.message || error);
  });

  console.log('✅ Bot handlers setup complete');
}

// ==================== STARTUP SEQUENCE ====================

async function startBot() {
  try {
    console.log('🚀 Starting Telegram Bot...');
    
    // Create and setup bot
    await createBot();
    
    // Setup message handlers
    setupBotHandlers();
    
    // Start session cleanup
    setInterval(cleanOldSessions, 10 * 60 * 1000);
    
    console.log('✅ Bot startup complete!');
    console.log('🤖 Yoldagilar Telegram Bot - Pure Polling Mode');
    console.log(`📊 Admin ID: ${CONFIG.ADMIN_ID}`);
    console.log(`🌐 Mini App URL: ${CONFIG.MINI_APP_URL}`);
    console.log(`📡 API Base URL: ${CONFIG.API_BASE_URL}`);
    console.log('🔄 Bot is ready and listening...');
    
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

// ==================== GRACEFUL SHUTDOWN ====================

async function gracefulShutdown() {
  console.log('🛑 Shutting down bot gracefully...');
  
  try {
    if (bot) {
      await bot.stopPolling();
      console.log('✅ Polling stopped');
    }
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
  }
  
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// ==================== START THE BOT ====================

startBot().catch(error => {
  console.error('❌ Startup failed:', error);
  process.exit(1);
});

// Export for external use
export default bot;