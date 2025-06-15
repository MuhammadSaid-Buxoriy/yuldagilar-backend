import supabase from '../config/database.js';
import logger from '../utils/logger.js';

export class DatabaseService {
  /**
   * Get user by Telegram ID
   */
  static async getUserByTelegramId(tg_id) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('tg_id', tg_id)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Database error in getUserByTelegramId:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error in getUserByTelegramId:', error);
      throw error;
    }
  }

  /**
   * Create new user
   */
  static async createUser(userData) {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert({
          tg_id: userData.tg_id,
          name: userData.name,
          username: userData.username || null,
          photo_url: userData.photo_url || null,
          is_registered: true,
          is_approved: false,
          achievements: []
        })
        .select()
        .single();

      if (error) {
        logger.error('Database error in createUser:', error);
        throw error;
      }

      logger.info(`User created: ${userData.tg_id} - ${userData.name}`);
      return data;
    } catch (error) {
      logger.error('Error in createUser:', error);
      throw error;
    }
  }

  // =====================================================
  // ✅ YANGI: USER PHOTO YANGILASH FUNKSIYALARI
  // =====================================================

  /**
   * Update user photo_url
   */
  static async updateUserPhoto(tg_id, photo_url) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ 
          photo_url,
          updated_at: new Date().toISOString()
        })
        .eq('tg_id', tg_id)
        .select()
        .single();

      if (error) {
        logger.error('Database error in updateUserPhoto:', error);
        throw error;
      }

      logger.info(`Photo updated for user ${tg_id}: ${photo_url ? 'Photo set' : 'Photo removed'}`);
      return data;
    } catch (error) {
      logger.error('Error in updateUserPhoto:', error);
      throw error;
    }
  }

  /**
   * Get users for photo sync (last checked more than 1 hour ago)
   */
  static async getUsersForPhotoSync(limit = 100) {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('users')
        .select('tg_id, name, photo_url, updated_at')
        .eq('is_approved', true)
        .or(`updated_at.lt.${oneHourAgo},updated_at.is.null`)
        .limit(limit);

      if (error) {
        logger.error('Database error in getUsersForPhotoSync:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getUsersForPhotoSync:', error);
      throw error;
    }
  }

  /**
   * Batch update multiple users' photos
   */
  static async batchUpdatePhotos(updates) {
    try {
      const updatePromises = updates.map(async ({ tg_id, photo_url }) => {
        return this.updateUserPhoto(tg_id, photo_url);
      });

      const results = await Promise.allSettled(updatePromises);
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      logger.info(`Batch photo update completed: ${successful} successful, ${failed} failed`);
      
      return {
        successful,
        failed,
        results: results.map((result, index) => ({
          tg_id: updates[index].tg_id,
          success: result.status === 'fulfilled',
          error: result.status === 'rejected' ? result.reason : null
        }))
      };
    } catch (error) {
      logger.error('Error in batchUpdatePhotos:', error);
      throw error;
    }
  }

  /**
   * Update user approval status
   */
  static async updateUserApproval(tg_id, is_approved) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ 
          is_approved,
          updated_at: new Date().toISOString()
        })
        .eq('tg_id', tg_id)
        .select()
        .single();

      if (error) {
        logger.error('Database error in updateUserApproval:', error);
        throw error;
      }

      logger.info(`User approval updated: ${tg_id} - ${is_approved}`);
      return data;
    } catch (error) {
      logger.error('Error in updateUserApproval:', error);
      throw error;
    }
  }

  /**
   * Get user statistics with caching
   */
  static async getUserStatistics(tg_id) {
    try {
      const { data, error } = await supabase
        .from('user_statistics')
        .select('*')
        .eq('tg_id', tg_id)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Database error in getUserStatistics:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error in getUserStatistics:', error);
      throw error;
    }
  }

  /**
   * Submit or update daily progress
   */
  static async upsertDailyProgress(progressData) {
    try {
      const { data, error } = await supabase
        .from('daily_progress')
        .upsert(progressData, {
          onConflict: 'tg_id,date',
          returning: 'representation'
        })
        .select()
        .single();

      if (error) {
        logger.error('Database error in upsertDailyProgress:', error);
        throw error;
      }

      logger.info(`Progress updated: ${progressData.tg_id} - ${progressData.date} - ${data.total_points} points`);
      return data;
    } catch (error) {
      logger.error('Error in upsertDailyProgress:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard with pagination
   */
  static async getLeaderboard(options = {}) {
    try {
      const {
        period = 'weekly',
        type = 'overall',
        limit = 100,
        offset = 0
      } = options;

      // Determine score field based on period
      let orderField;
      switch (period) {
        case 'daily':
          orderField = 'daily_points';
          break;
        case 'all_time':
          orderField = 'total_points';
          break;
        default:
          orderField = 'weekly_points';
      }

      const { data, error } = await supabase
        .from('user_statistics')
        .select(`
          tg_id,
          name,
          username,
          photo_url,
          achievements,
          daily_points,
          weekly_points,
          total_points,
          total_pages,
          total_distance
        `)
        .gt(orderField, 0)
        .order(orderField, { ascending: false })
        .order('tg_id', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Database error in getLeaderboard:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getLeaderboard:', error);
      throw error;
    }
  }

  /**
   * Get user progress history
   */
  static async getUserProgressHistory(tg_id, days = 60) {
    try {
      const { data, error } = await supabase
        .from('daily_progress')
        .select('date, total_points, pages_read, distance_km')
        .eq('tg_id', tg_id)
        .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) {
        logger.error('Database error in getUserProgressHistory:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getUserProgressHistory:', error);
      throw error;
    }
  }

  /**
   * Get total user count
   */
  static async getTotalUserCount() {
    try {
      const { count, error } = await supabase
        .from('users')
        .select('tg_id', { count: 'exact' })
        .eq('is_approved', true);

      if (error) {
        logger.error('Database error in getTotalUserCount:', error);
        throw error;
      }

      return count || 0;
    } catch (error) {
      logger.error('Error in getTotalUserCount:', error);
      return 0;
    }
  }

  /**
   * Bulk update user achievements
   */
  static async updateUserAchievements(tg_id, achievements) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ 
          achievements,
          updated_at: new Date().toISOString()
        })
        .eq('tg_id', tg_id)
        .select()
        .single();

      if (error) {
        logger.error('Database error in updateUserAchievements:', error);
        throw error;
      }

      logger.info(`Achievements updated: ${tg_id} - ${achievements.join(', ')}`);
      return data;
    } catch (error) {
      logger.error('Error in updateUserAchievements:', error);
      throw error;
    }
  }

  /**
   * Delete user (for admin rejection)
   */
  static async deleteUser(tg_id) {
    try {
      const { data, error } = await supabase
        .from('users')
        .delete()
        .eq('tg_id', tg_id)
        .eq('is_approved', false)
        .select()
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Database error in deleteUser:', error);
        throw error;
      }

      logger.info(`User deleted: ${tg_id}`);
      return data;
    } catch (error) {
      logger.error('Error in deleteUser:', error);
      throw error;
    }
  }
}