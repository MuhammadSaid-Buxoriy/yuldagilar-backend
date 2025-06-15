// =====================================================
// TELEGRAM SERVICE - Profil rasmini olish va yangilash
// =====================================================
import TelegramBot from 'node-telegram-bot-api';
import logger from '../utils/logger.js';

class TelegramService {
  constructor() {
    this.bot = new TelegramBot(process.env.BOT_TOKEN);
  }

  /**
   * Telegram profil rasmini olish
   */
  async getUserProfilePhoto(userId) {
    try {
      logger.info(`🔍 Getting profile photo for user: ${userId}`);
      
      const photos = await this.bot.getUserProfilePhotos(userId, { 
        limit: 1,
        offset: 0 
      });
      
      if (!photos || photos.total_count === 0) {
        logger.info(`📷 No profile photo found for user: ${userId}`);
        return null;
      }

      // Eng kichik o'lchamdagi rasmni olish (tez yuklash uchun)
      const photo = photos.photos[0][0]; // First photo, smallest size
      const fileLink = await this.bot.getFileLink(photo.file_id);
      
      logger.info(`✅ Profile photo found for user ${userId}: ${fileLink}`);
      return fileLink;
      
    } catch (error) {
      logger.error(`❌ Error getting profile photo for user ${userId}:`, error);
      
      // Telegram API xatoliklarini handle qilish
      if (error.code === 'ETELEGRAM') {
        if (error.response?.body?.error_code === 400) {
          logger.warn(`⚠️ User ${userId} not found in Telegram`);
          return null;
        }
        if (error.response?.body?.error_code === 429) {
          logger.warn(`⚠️ Rate limit hit for user ${userId}`);
          return null;
        }
      }
      
      return null;
    }
  }

  /**
   * Avatar generator - fallback rasm yaratish
   */
  generateAvatarUrl(name, userId) {
    try {
      const colors = [
        '3b82f6', 'ef4444', '10b981', 'f59e0b', '8b5cf6', 
        'ec4899', '06b6d4', '84cc16', 'f97316', '6366f1'
      ];
      
      const firstLetter = (name || 'U').charAt(0).toUpperCase();
      const colorIndex = (userId || 0) % colors.length;
      const bgColor = colors[colorIndex];
      
      // UI Avatars service ishlatish
      const avatarUrl = `https://ui-avatars.com/api/?` +
        `name=${encodeURIComponent(firstLetter)}&` +
        `background=${bgColor}&` +
        `color=ffffff&` +
        `size=200&` +
        `font-size=0.6&` +
        `bold=true&` +
        `format=png`;
      
      logger.info(`🎨 Generated avatar for ${name} (${userId}): ${avatarUrl}`);
      return avatarUrl;
      
    } catch (error) {
      logger.error('❌ Error generating avatar:', error);
      // Fallback avatar
      return 'https://ui-avatars.com/api/?name=U&background=6366f1&color=ffffff&size=200';
    }
  }

  /**
   * User ma'lumotlarini Telegram dan olish
   */
  async getUserInfo(userId) {
    try {
      // getUserProfilePhotos orqali user mavjudligini tekshirish
      const photos = await this.bot.getUserProfilePhotos(userId, { limit: 1 });
      
      // Agar photos response bo'lsa, user mavjud
      if (photos) {
        return {
          exists: true,
          hasPhoto: photos.total_count > 0
        };
      }
      
      return { exists: false, hasPhoto: false };
      
    } catch (error) {
      logger.error(`❌ Error checking user info for ${userId}:`, error);
      return { exists: false, hasPhoto: false };
    }
  }

  /**
   * Batch photo update - bir necha userni birdan tekshirish
   */
  async batchUpdatePhotos(userIds) {
    const results = [];
    const BATCH_SIZE = 5; // Rate limit uchun
    
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (userId) => {
        try {
          const photoUrl = await this.getUserProfilePhoto(userId);
          return { userId, photoUrl, success: true };
        } catch (error) {
          logger.error(`❌ Batch photo update failed for ${userId}:`, error);
          return { userId, photoUrl: null, success: false, error: error.message };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Rate limit uchun kechikish
      if (i + BATCH_SIZE < userIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  /**
   * Cache bilan optimallashtirilgan photo olish
   */
  async getUserProfilePhotoWithCache(userId, lastCheckTime = null) {
    try {
      // Agar oxirgi tekshirish 1 soat ichida bo'lgan bo'lsa, cache ishlatish
      const ONE_HOUR = 60 * 60 * 1000;
      const now = Date.now();
      
      if (lastCheckTime && (now - new Date(lastCheckTime).getTime()) < ONE_HOUR) {
        logger.info(`🔄 Using cached photo check for user ${userId}`);
        return { cached: true };
      }
      
      const photoUrl = await this.getUserProfilePhoto(userId);
      return { 
        photoUrl, 
        cached: false, 
        checkedAt: new Date().toISOString() 
      };
      
    } catch (error) {
      logger.error(`❌ Cached photo check failed for ${userId}:`, error);
      return { photoUrl: null, cached: false, error: error.message };
    }
  }
}

// Singleton instance
const telegramService = new TelegramService();

export default telegramService;