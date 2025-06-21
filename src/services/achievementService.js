// =====================================================
// ACHIEVEMENT SERVICE - TO'LIQ TUZATILGAN VERSIYA
// =====================================================
import { DatabaseService } from "./databaseService.js";
import logger from "../utils/logger.js";

export class AchievementService {
  static ACHIEVEMENT_DEFINITIONS = {
    consistent: {
      id: "consistent",
      name: "Faol",
      description: "21 kun ketma-ket faol bo'lish",
      icon: "🔥",
      color: "#ef4444",
      checkFunction: "checkConsistentAchievement",
    },
    reader: {
      id: "reader",
      name: "Kitobxon", 
      description: "6,000 bet kitob o'qish",
      icon: "📚",
      color: "#3b82f6",
      checkFunction: "checkReaderAchievement",
    },
    athlete: {
      id: "athlete",
      name: "Sportchi",
      description: "100 km yugurish",
      icon: "🏃‍♂️",
      color: "#10b981",
      checkFunction: "checkAthleteAchievement",
    },
    early_bird: {
      id: "early_bird", 
      name: "Uyg'oq",
      description: "21 kun ketma-ket erta turish",
      icon: "🌅",
      color: "#8b5cf6",
      checkFunction: "checkEarlyBirdAchievement",
    },
    perfectionist: {
      id: "perfectionist",
      name: "Olov",
      description: "21 kun ketma-ket 10/10 vazifa",
      icon: "⭐",
      color: "#f59e0b",
      checkFunction: "checkPerfectionistAchievement",
    },
  };

  /**
   * ✅ ASOSIY FUNKSIYA: Check and update all achievements for a user
   */
  static async updateUserAchievements(tg_id) {
    try {
      console.log(`🏆 Checking achievements for user ${tg_id}...`);
      
      const progressHistory = await DatabaseService.getUserProgressHistory(tg_id, 60);
      const user = await DatabaseService.getUserByTelegramId(tg_id);

      if (!user || !progressHistory) {
        console.log(`ℹ️ No user or progress data for ${tg_id}`);
        return [];
      }

      const currentAchievements = user.achievements || [];
      const newAchievements = [...currentAchievements];

      console.log(`📊 Current achievements for ${tg_id}:`, currentAchievements);

      // Check each achievement
      for (const achievement of Object.values(this.ACHIEVEMENT_DEFINITIONS)) {
        if (!currentAchievements.includes(achievement.id)) {
          const earned = await this[achievement.checkFunction](progressHistory);
          if (earned) {
            newAchievements.push(achievement.id);
            console.log(`🎉 NEW achievement earned: ${tg_id} - ${achievement.id} (${achievement.name})`);
          }
        }
      }

      // Update if new achievements earned
      if (newAchievements.length > currentAchievements.length) {
        await DatabaseService.updateUserAchievements(tg_id, newAchievements);
        const earnedNew = newAchievements.filter((a) => !currentAchievements.includes(a));
        console.log(`✅ Updated achievements for ${tg_id}. New:`, earnedNew);
        return earnedNew;
      }

      console.log(`ℹ️ No new achievements for ${tg_id}`);
      return [];
    } catch (error) {
      logger.error("Error in updateUserAchievements:", error);
      return [];
    }
  }

  /**
   * ✅ TUZATILGAN: Check consistent achievement (21 consecutive days with activity)
   * MUHIM: Zanjir uzilsa 0 dan boshlanadi!
   */
  static async checkConsistentAchievement(progressHistory) {
    let consecutiveDays = 0;
    const today = new Date();

    console.log('🔍 Checking consistent achievement...');

    // Bugundan boshlab orqaga qarab 60 kun tekshirish
    for (let i = 0; i < 60; i++) {
      const targetDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      
      const dayData = progressHistory.find((p) => p.date === targetDate);

      if (dayData && dayData.total_points > 0) {
        consecutiveDays++;
        // 21 kun to'lsa - achievement earned!
        if (consecutiveDays >= 21) {
          console.log(`✅ Consistent achievement earned! ${consecutiveDays} consecutive days`);
          return true;
        }
      } else {
        // ❌ Zanjir uzildi - to'xtash
        console.log(`❌ Consistent streak broken at day ${i}, total consecutive: ${consecutiveDays}`);
        break;
      }
    }

    console.log(`📊 Consistent progress: ${consecutiveDays}/21 consecutive days`);
    return false;
  }

  /**
   * ✅ TUZATILGAN: Check reader achievement (6000+ pages total)
   */
  static async checkReaderAchievement(progressHistory) {
    const totalPages = progressHistory.reduce(
      (sum, day) => sum + (day.pages_read || 0),
      0
    );
    
    console.log(`📚 Reader check: ${totalPages}/6000 pages`);
    
    const earned = totalPages >= 6000;
    if (earned) {
      console.log(`✅ Reader achievement earned! ${totalPages} pages read`);
    }
    
    return earned;
  }

  /**
   * ✅ TUZATILGAN: Check athlete achievement (100+ km total)
   */
  static async checkAthleteAchievement(progressHistory) {
    const totalDistance = progressHistory.reduce(
      (sum, day) => sum + (parseFloat(day.distance_km) || 0),
      0
    );
    
    console.log(`🏃‍♂️ Athlete check: ${totalDistance}/100 km`);
    
    const earned = totalDistance >= 100;
    if (earned) {
      console.log(`✅ Athlete achievement earned! ${totalDistance} km distance`);
    }
    
    return earned;
  }

  /**
   * ✅ TUZATILGAN: Check perfectionist achievement (21 consecutive days 10/10 tasks)
   * MUHIM: Zanjir uzilsa 0 dan boshlanadi!
   */
  static async checkPerfectionistAchievement(progressHistory) {
    let consecutiveStreak = 0;
    const today = new Date();

    console.log('🔍 Checking perfectionist achievement...');

    // Bugundan boshlab orqaga qarab tekshirish
    for (let i = 0; i < 60; i++) {
      const targetDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const dayData = progressHistory.find((p) => p.date === targetDate);

      if (dayData) {
        // ✅ MUHIM: Barcha 10 ta vazifa bajarilganmi tekshirish
        const allTasksCompleted = [
          dayData.shart_1, dayData.shart_2, dayData.shart_3, dayData.shart_4, dayData.shart_5,
          dayData.shart_6, dayData.shart_7, dayData.shart_8, dayData.shart_9, dayData.shart_10
        ].every((task) => task === 1 || task === true);

        if (allTasksCompleted) {
          consecutiveStreak++;
          console.log(`✅ Perfect day ${i}: ${targetDate} (${consecutiveStreak}/21)`);
          
          // Agar 21 kun to'lsa - muvaffaqiyat!
          if (consecutiveStreak >= 21) {
            console.log(`🎉 Perfectionist achievement earned! ${consecutiveStreak} consecutive perfect days`);
            return true;
          }
        } else {
          // ❌ Zanjir uzildi - to'xtash
          console.log(`❌ Perfectionist streak broken at day ${i} (${targetDate}). Total points: ${dayData.total_points}/10`);
          break;
        }
      } else {
        // ❌ Ma'lumot yo'q - zanjir uzildi
        console.log(`❌ Perfectionist streak broken at day ${i} (${targetDate}) - no data`);
        break;
      }
    }

    console.log(`📊 Perfectionist progress: ${consecutiveStreak}/21 perfect days`);
    return false;
  }

  /**
   * ✅ TUZATILGAN: Check early bird achievement (21 consecutive days task 9 completed)
   * MUHIM: Faqat shart_9 (erta turish) vazifasi tekshiriladi!
   */
  static async checkEarlyBirdAchievement(progressHistory) {
    let consecutiveStreak = 0;
    const today = new Date();

    console.log('🔍 Checking early bird achievement (task 9 - early wake up)...');

    // Bugundan boshlab orqaga qarab tekshirish
    for (let i = 0; i < 60; i++) {
      const targetDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const dayData = progressHistory.find((p) => p.date === targetDate);

      if (dayData && (dayData.shart_9 === 1 || dayData.shart_9 === true)) {
        consecutiveStreak++;
        console.log(`🌅 Early wake day ${i}: ${targetDate} (${consecutiveStreak}/21)`);
        
        // Agar 21 kun to'lsa - muvaffaqiyat!
        if (consecutiveStreak >= 21) {
          console.log(`🎉 Early Bird achievement earned! ${consecutiveStreak} consecutive early wake days`);
          return true;
        }
      } else {
        // ❌ Zanjir uzildi - to'xtash  
        console.log(`❌ Early bird streak broken at day ${i} (${targetDate}). Task 9 status: ${dayData?.shart_9 || 'no data'}`);
        break;
      }
    }

    console.log(`📊 Early bird progress: ${consecutiveStreak}/21 consecutive early wake days`);
    return false;
  }

  /**
   * ✅ YANGI: Get current consistent streak
   */
  static async getConsistentStreak(progressHistory) {
    let consecutive = 0;
    const today = new Date();
    
    for (let i = 0; i < progressHistory.length; i++) {
      const expectedDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const dayData = progressHistory.find((p) => p.date === expectedDate);

      if (dayData && dayData.total_points > 0) {
        consecutive++;
      } else {
        break;
      }

      // Maksimal 30 kun hisoblash
      if (i >= 30) break;
    }
    
    return consecutive;
  }

  /**
   * ✅ YANGI: Get current early bird streak
   */
  static async getEarlyBirdStreak(progressHistory) {
    let consecutiveStreak = 0;
    const today = new Date();

    // Bugundan boshlab orqaga qarab tekshirish
    for (let i = 0; i < 60; i++) {
      const targetDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const dayData = progressHistory.find((p) => p.date === targetDate);

      if (dayData && (dayData.shart_9 === 1 || dayData.shart_9 === true)) {
        consecutiveStreak++;
      } else {
        break;
      }

      // Maksimal 30 kun hisoblash
      if (i >= 30) break;
    }

    return consecutiveStreak;
  }

  /**
   * ✅ YANGI: Get current perfectionist streak
   */
  static async getPerfectionistStreak(progressHistory) {
    let consecutiveStreak = 0;
    const today = new Date();

    // Bugundan boshlab orqaga qarab tekshirish
    for (let i = 0; i < 60; i++) {
      const targetDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const dayData = progressHistory.find((p) => p.date === targetDate);

      if (dayData) {
        // Barcha 10 ta vazifa bajarilganmi tekshirish
        const allTasksCompleted = [
          dayData.shart_1, dayData.shart_2, dayData.shart_3, dayData.shart_4, dayData.shart_5,
          dayData.shart_6, dayData.shart_7, dayData.shart_8, dayData.shart_9, dayData.shart_10
        ].every((task) => task === 1 || task === true);

        if (allTasksCompleted) {
          consecutiveStreak++;
        } else {
          break;
        }
      } else {
        break;
      }

      // Maksimal 30 kun hisoblash
      if (i >= 30) break;
    }

    return consecutiveStreak;
  }

  /**
   * ✅ ASOSIY FUNKSIYA: Get achievement progress for user (Frontend uchun)
   */
  static async getAchievementProgress(tg_id) {
    try {
      console.log(`🏆 Getting achievement progress for user ${tg_id}...`);
      
      const progressHistory = await DatabaseService.getUserProgressHistory(tg_id, 60);
      const user = await DatabaseService.getUserByTelegramId(tg_id);

      if (!user || !progressHistory) {
        console.log(`❌ No user or progress data for ${tg_id}`);
        return [];
      }

      const userAchievements = user.achievements || [];
      const progress = [];

      console.log(`📊 User ${tg_id} current achievements:`, userAchievements);

      for (const achievement of Object.values(this.ACHIEVEMENT_DEFINITIONS)) {
        const earned = userAchievements.includes(achievement.id);
        let currentProgress = 0;
        let maxProgress = 100;

        // ✅ Calculate real-time progress based on achievement type
        switch (achievement.id) {
          case "consistent":
            currentProgress = await this.getConsistentStreak(progressHistory);
            maxProgress = 21;
            break;
            
          case "reader":
            currentProgress = progressHistory.reduce(
              (sum, day) => sum + (day.pages_read || 0),
              0
            );
            maxProgress = 6000;
            break;
            
          case "athlete":
            currentProgress = Math.round(progressHistory.reduce(
              (sum, day) => sum + (parseFloat(day.distance_km) || 0),
              0
            ) * 100) / 100; // 2 decimal places
            maxProgress = 100;
            break;
            
          case "perfectionist":
            currentProgress = await this.getPerfectionistStreak(progressHistory);
            maxProgress = 21;
            break;
            
          case "early_bird":
            currentProgress = await this.getEarlyBirdStreak(progressHistory);
            maxProgress = 21;
            break;
        }

        const percentage = Math.min((currentProgress / maxProgress) * 100, 100);

        progress.push({
          ...achievement,
          earned,
          current: Math.min(currentProgress, maxProgress),
          max: maxProgress,
          percentage: Math.round(percentage * 10) / 10, // 1 decimal place
        });

        console.log(`📊 ${achievement.name}: ${currentProgress}/${maxProgress} (${percentage.toFixed(1)}%) - ${earned ? 'EARNED' : 'NOT EARNED'}`);
      }

      console.log(`✅ Achievement progress calculated for user ${tg_id}: ${progress.length} achievements`);
      return progress;
      
    } catch (error) {
      logger.error("Error in getAchievementProgress:", error);
      return [];
    }
  }

  /**
   * ✅ YANGI: Get achievement summary for user profile
   */
  static async getAchievementSummary(tg_id) {
    try {
      const progress = await this.getAchievementProgress(tg_id);
      
      const summary = {
        total_achievements: progress.length,
        earned_count: progress.filter(p => p.earned).length,
        in_progress_count: progress.filter(p => !p.earned && p.current > 0).length,
        completion_percentage: Math.round((progress.filter(p => p.earned).length / progress.length) * 100),
        
        // Closest to completion
        closest_achievement: progress
          .filter(p => !p.earned)
          .sort((a, b) => b.percentage - a.percentage)[0] || null,
          
        // Recently earned (last 7 days)
        recently_earned: progress.filter(p => p.earned), // TODO: Add date tracking
        
        // Progress details
        achievements: progress
      };

      return summary;
    } catch (error) {
      logger.error("Error in getAchievementSummary:", error);
      return {
        total_achievements: 5,
        earned_count: 0,
        in_progress_count: 0,
        completion_percentage: 0,
        closest_achievement: null,
        recently_earned: [],
        achievements: []
      };
    }
  }

  /**
   * ✅ YANGI: Check if user deserves a badge display name update
   */
  static async getBadgeDisplayName(tg_id, originalName) {
    try {
      const user = await DatabaseService.getUserByTelegramId(tg_id);
      if (!user || !user.achievements) {
        return originalName;
      }

      const achievements = user.achievements;
      const badges = [];

      // Add badges based on achievements
      if (achievements.includes('perfectionist')) {
        badges.push('🔥'); // Olov
      }
      if (achievements.includes('early_bird')) {
        badges.push('🌅'); // Uyg'oq
      }
      if (achievements.includes('consistent')) {
        badges.push('⚡'); // Faol
      }
      if (achievements.includes('reader')) {
        badges.push('📚'); // Kitobxon
      }
      if (achievements.includes('athlete')) {
        badges.push('🏃‍♂️'); // Sportchi
      }

      // Return name with badges
      if (badges.length > 0) {
        return `${originalName} ${badges.join('')}`;
      }

      return originalName;
    } catch (error) {
      logger.error("Error in getBadgeDisplayName:", error);
      return originalName;
    }
  }

  /**
   * ✅ YANGI: Debug achievement status for user
   */
  static async debugAchievements(tg_id) {
    try {
      console.log(`🔍 DEBUGGING achievements for user ${tg_id}...`);
      
      const progressHistory = await DatabaseService.getUserProgressHistory(tg_id, 30);
      const user = await DatabaseService.getUserByTelegramId(tg_id);

      console.log(`📊 Progress history: ${progressHistory?.length || 0} days`);
      console.log(`👤 User achievements:`, user?.achievements || []);

      // Debug each achievement
      for (const achievement of Object.values(this.ACHIEVEMENT_DEFINITIONS)) {
        console.log(`\n🏆 Checking ${achievement.name} (${achievement.id}):`);
        
        const isEarned = await this[achievement.checkFunction](progressHistory);
        console.log(`   Result: ${isEarned ? '✅ EARNED' : '❌ NOT EARNED'}`);
      }

      // Debug recent progress
      console.log(`\n📅 Recent progress (last 7 days):`);
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const targetDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        
        const dayData = progressHistory?.find(p => p.date === targetDate);
        
        if (dayData) {
          const allTasks = [
            dayData.shart_1, dayData.shart_2, dayData.shart_3, dayData.shart_4, dayData.shart_5,
            dayData.shart_6, dayData.shart_7, dayData.shart_8, dayData.shart_9, dayData.shart_10
          ];
          const completedTasks = allTasks.filter(t => t === 1).length;
          
          console.log(`   ${targetDate}: ${completedTasks}/10 tasks, task9: ${dayData.shart_9 ? '✅' : '❌'}, pages: ${dayData.pages_read || 0}, km: ${dayData.distance_km || 0}`);
        } else {
          console.log(`   ${targetDate}: No data`);
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Debug error:', error);
      return false;
    }
  }
}