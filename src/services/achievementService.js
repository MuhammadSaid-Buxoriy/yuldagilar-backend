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
      description: "10,000 bet kitob o'qish",
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
    perfectionist: {
      id: "perfectionist",
      name: "Olov",
      description: "21 kun ketma-ket 10/10 vazifa bajarish",
      icon: "⭐",
      color: "#f59e0b",
      checkFunction: "checkPerfectionistAchievement",
    },
    early_bird: {
      id: "early_bird",
      name: "Uyg'oq",
      description: "21 kun ketma-ket erta turish",
      icon: "🌅",
      color: "#8b5cf6",
      checkFunction: "checkEarlyBirdAchievement",
    },
  };

  /**
   * Check and update all achievements for a user
   */
  static async updateUserAchievements(tg_id) {
    try {
      const progressHistory = await DatabaseService.getUserProgressHistory(
        tg_id,
        30
      );
      const user = await DatabaseService.getUserByTelegramId(tg_id);

      if (!user || !progressHistory) {
        return [];
      }

      const currentAchievements = user.achievements || [];
      const newAchievements = [...currentAchievements];

      // Check each achievement
      for (const achievement of Object.values(this.ACHIEVEMENT_DEFINITIONS)) {
        if (!currentAchievements.includes(achievement.id)) {
          const earned = await this[achievement.checkFunction](progressHistory);
          if (earned) {
            newAchievements.push(achievement.id);
            logger.info(`New achievement earned: ${tg_id} - ${achievement.id}`);
          }
        }
      }

      // Update if new achievements earned
      if (newAchievements.length > currentAchievements.length) {
        await DatabaseService.updateUserAchievements(tg_id, newAchievements);
        return newAchievements.filter((a) => !currentAchievements.includes(a));
      }

      return [];
    } catch (error) {
      logger.error("Error in updateUserAchievements:", error);
      return [];
    }
  }

  /**
   * Check consistent achievement (7 consecutive days)
   */
  static async checkConsistentAchievement(progressHistory) {
    let consecutiveDays = 0;
    const today = new Date().toISOString().split("T")[0];

    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const dayData = progressHistory.find((p) => p.date === targetDate);

      if (dayData && dayData.total_points > 0) {
        consecutiveDays++;
      } else {
        break;
      }
    }

    return consecutiveDays >= 7;
  }

  /**
   * Check reader achievement (100+ pages total)
   */
  static async checkReaderAchievement(progressHistory) {
    const totalPages = progressHistory.reduce(
      (sum, day) => sum + (day.pages_read || 0),
      0
    );
    return totalPages >= 100;
  }

  /**
   * Check athlete achievement (50+ km total)
   */
  static async checkAthleteAchievement(progressHistory) {
    const totalDistance = progressHistory.reduce(
      (sum, day) => sum + (day.distance_km || 0),
      0
    );
    return totalDistance >= 50;
  }

  /**
   * Check perfectionist achievement (3 perfect days)
   */
  static async checkPerfectionistAchievement(progressHistory) {
    const perfectDays = progressHistory.filter(
      (day) => day.total_points === 10
    ).length;
    return perfectDays >= 3;
  }

  /**
   * Check early bird achievement (task 9 completed 14 times)
   */
  static async checkEarlyBirdAchievement(progressHistory) {
    // This would need additional data about specific task completion
    // For now, approximate based on high activity
    const earlyDays = progressHistory.filter(
      (day) => day.total_points >= 8
    ).length;
    return earlyDays >= 14;
  }

  /**
   * Get achievement progress for user
   */
  static async getAchievementProgress(tg_id) {
    try {
      const progressHistory = await DatabaseService.getUserProgressHistory(
        tg_id,
        30
      );
      const user = await DatabaseService.getUserByTelegramId(tg_id);

      if (!user || !progressHistory) {
        return [];
      }

      const userAchievements = user.achievements || [];
      const progress = [];

      for (const achievement of Object.values(this.ACHIEVEMENT_DEFINITIONS)) {
        const earned = userAchievements.includes(achievement.id);
        let currentProgress = 0;
        let maxProgress = 100;

        // Calculate progress based on achievement type
        switch (achievement.id) {
          case "consistent":
            currentProgress = await this.getConsistentProgress(progressHistory);
            maxProgress = 7;
            break;
          case "reader":
            currentProgress = progressHistory.reduce(
              (sum, day) => sum + (day.pages_read || 0),
              0
            );
            maxProgress = 100;
            break;
          case "athlete":
            currentProgress = progressHistory.reduce(
              (sum, day) => sum + (day.distance_km || 0),
              0
            );
            maxProgress = 50;
            break;
          case "perfectionist":
            currentProgress = progressHistory.filter(
              (day) => day.total_points === 10
            ).length;
            maxProgress = 3;
            break;
        }

        progress.push({
          ...achievement,
          earned,
          current: Math.min(currentProgress, maxProgress),
          max: maxProgress,
          percentage: Math.min((currentProgress / maxProgress) * 100, 100),
        });
      }

      return progress;
    } catch (error) {
      logger.error("Error in getAchievementProgress:", error);
      return [];
    }
  }

  /**
   * Get current consistent streak
   */
  static async getConsistentProgress(progressHistory) {
    let consecutive = 0;
    for (let i = 0; i < progressHistory.length; i++) {
      const expectedDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const dayData = progressHistory.find((p) => p.date === expectedDate);

      if (dayData && dayData.total_points > 0) {
        consecutive++;
      } else {
        break;
      }
    }
    return consecutive;
  }
}
