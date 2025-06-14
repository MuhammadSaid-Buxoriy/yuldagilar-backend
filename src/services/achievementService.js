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
        60
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
   * Check consistent achievement (21 consecutive days)
   */
  static async checkConsistentAchievement(progressHistory) {
    let consecutiveDays = 0;
    const today = new Date().toISOString().split("T")[0];

    for (let i = 0; i < 21; i++) {
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

    return consecutiveDays >= 21;
  }

  /**
   * Check reader achievement (10000+ pages total)
   */
  static async checkReaderAchievement(progressHistory) {
    const totalPages = progressHistory.reduce(
      (sum, day) => sum + (day.pages_read || 0),
      0
    );
    return totalPages >= 10000;
  }

  /**
   * Check athlete achievement (100+ km total)
   */
  static async checkAthleteAchievement(progressHistory) {
    const totalDistance = progressHistory.reduce(
      (sum, day) => sum + (day.distance_km || 0),
      0
    );
    return totalDistance >= 100;
  }

  /**
   * Check perfectionist achievement (10/10 tasks for 21 consecutive days)
   */
  static async checkPerfectionistAchievement(progressHistory) {
    let streak = 0;

    const today = new Date();
    for (let i = 0; i < progressHistory.length; i++) {
      const expectedDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const day = progressHistory.find((p) => p.date === expectedDate);

      if (day) {
        const tasksCompleted = Array.from(
          { length: 10 },
          (_, idx) => day[`shart_${idx + 1}`]
        );
        const allCompleted = tasksCompleted.every(
          (val) => val === 1 || val === true
        );

        if (allCompleted) {
          streak++;
          if (streak >= 21) return true;
        } else {
          streak = 0;
        }
      } else {
        streak = 0;
      }
    }

    return false;
  }

  /**
   * Check early bird achievement (task 9 completed 21 consecutive days)
   */
  static async checkEarlyBirdAchievement(progressHistory) {
    let streak = 0;
    const today = new Date();

    for (let i = 0; i < progressHistory.length; i++) {
      const expectedDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const day = progressHistory.find((p) => p.date === expectedDate);

      if (day && day.shart_9 === 1) {
        streak++;
        if (streak >= 21) return true;
      } else {
        streak = 0; // uzildi - qaytadan boshlaymiz
      }
    }

    return false;
  }

  /**
   * Get current early bird streak (consecutive days task 9 completed)
   */
  static async getEarlyBirdProgress(progressHistory) {
    let streak = 0;

    for (let i = 0; i < 60; i++) {
      const targetDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const day = progressHistory.find((p) => p.date === targetDate);

      if (day && day.shart_9 === 1) {
        streak++;
      } else {
        break; // uzildi
      }

      if (streak >= 21) break;
    }

    return streak;
  }

  static async getPerfectionistStreak(progressHistory) {
    let streak = 0;

    for (let i = 0; i < 60; i++) {
      const targetDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const day = progressHistory.find((p) => p.date === targetDate);
      if (!day) {
        streak = 0;
        continue;
      }

      const allTasksCompleted = Array.from(
        { length: 10 },
        (_, idx) => day[`shart_${idx + 1}`]
      ).every((val) => val === true || val === 1);

      if (allTasksCompleted) {
        streak++;
      } else {
        break;
      }

      if (streak >= 21) break;
    }

    return streak;
  }

  /**
   * Get achievement progress for user
   */
  static async getAchievementProgress(tg_id) {
    try {
      const progressHistory = await DatabaseService.getUserProgressHistory(
        tg_id,
        60
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
            maxProgress = 21;
            break;
          case "reader":
            currentProgress = progressHistory.reduce(
              (sum, day) => sum + (day.pages_read || 0),
              0
            );
            maxProgress = 10000;
            break;
          case "athlete":
            currentProgress = progressHistory.reduce(
              (sum, day) => sum + (day.distance_km || 0),
              0
            );
            maxProgress = 100;
            break;
          case "perfectionist":
            currentProgress = await this.getPerfectionistStreak(
              progressHistory
            );
            maxProgress = 21;
            break;
          case "early_bird":
            currentProgress = await this.getEarlyBirdProgress(progressHistory);
            maxProgress = 21;
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
