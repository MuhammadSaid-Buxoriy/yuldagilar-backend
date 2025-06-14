import { DatabaseService } from "./databaseService.js";
import logger from "../utils/logger.js";
import { AchievementService } from "./achievementService.js";

export class StatisticsService {
  /**
   * Get comprehensive user statistics
   */
  static async getUserStatistics(tg_id) {
    try {
      const stats = await DatabaseService.getUserStatistics(tg_id);
      if (!stats) {
        return null;
      }

      // Get weekly daily points for chart
      const weeklyDailyPoints = await this.getWeeklyDailyPoints(tg_id);
      const streak = await this.calculateUserStreak(tg_id);
      const longestStreak = await this.calculateLongestStreak(tg_id);

      // 💡 Yangi statistika: perfectionist va early bird
      const perfectionistStreak =
        await AchievementService.getPerfectionistStreak(progressHistory);
      const earlyBirdStreak = await AchievementService.getEarlyBirdProgress(
        progressHistory
      );

      return {
        today: {
          completed: stats.daily_points || 0,
          pages_read: stats.daily_pages || 0,
          distance_km: stats.daily_distance || 0,
        },
        weekly: {
          dailyPoints: weeklyDailyPoints,
          dailyTotal: 10,
          total_points: stats.weekly_points || 0,
          total_pages: stats.weekly_pages || 0,
          total_distance: stats.weekly_distance || 0,
        },
        all_time: {
          total_points: stats.total_points || 0,
          total_pages: stats.total_pages || 0,
          total_distance: stats.total_distance || 0,
          total_days: stats.total_days || 0,
          perfectionist_streak: perfectionistStreak,
          early_bird_streak: earlyBirdStreak,
        },
        streaks: {
          current: streak,
          longest: longestStreak,
        },
      };
    } catch (error) {
      logger.error("Error in getUserStatistics:", error);
      throw error;
    }
  }

  /**
   * Get weekly daily points for chart (last 7 days)
   */
  static async getWeeklyDailyPoints(tg_id) {
    try {
      const progressHistory = await DatabaseService.getUserProgressHistory(
        tg_id,
        7
      );

      const weeklyPoints = [];
      for (let i = 6; i >= 0; i--) {
        const targetDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        const dayData = progressHistory.find((p) => p.date === targetDate);
        weeklyPoints.push(dayData ? dayData.total_points : 0);
      }

      return weeklyPoints;
    } catch (error) {
      logger.error("Error in getWeeklyDailyPoints:", error);
      return [0, 0, 0, 0, 0, 0, 0];
    }
  }

  /**
   * Calculate current user streak
   */
  static async calculateUserStreak(tg_id) {
    try {
      const progressHistory = await DatabaseService.getUserProgressHistory(
        tg_id,
        60
      );

      let streak = 0;
      for (let i = 0; i < progressHistory.length; i++) {
        const expectedDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        const dayData = progressHistory.find((p) => p.date === expectedDate);

        if (dayData && dayData.total_points > 0) {
          streak++;
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      logger.error("Error in calculateUserStreak:", error);
      return 0;
    }
  }

  /**
   * Calculate longest streak for user
   */
  static async calculateLongestStreak(tg_id) {
    try {
      const { data: allProgress } = await supabase
        .from("daily_progress")
        .select("date, total_points")
        .eq("tg_id", tg_id)
        .gt("total_points", 0)
        .order("date", { ascending: true });

      if (!allProgress || allProgress.length === 0) {
        return 0;
      }

      let longestStreak = 1;
      let currentStreak = 1;

      for (let i = 1; i < allProgress.length; i++) {
        const prevDate = new Date(allProgress[i - 1].date);
        const currDate = new Date(allProgress[i].date);
        const dayDiff = (currDate - prevDate) / (1000 * 60 * 60 * 24);

        if (dayDiff === 1) {
          currentStreak++;
          longestStreak = Math.max(longestStreak, currentStreak);
        } else {
          currentStreak = 1;
        }
      }

      return longestStreak;
    } catch (error) {
      logger.error("Error in calculateLongestStreak:", error);
      return 0;
    }
  }

  /**
   * Get global statistics
   */
  static async getGlobalStatistics() {
    try {
      const totalUsers = await DatabaseService.getTotalUserCount();

      // Get today's active users
      const { count: todayActiveUsers } = await supabase
        .from("daily_progress")
        .select("tg_id", { count: "exact" })
        .eq("date", new Date().toISOString().split("T")[0])
        .gt("total_points", 0);

      // Get total points today
      const { data: todayStats } = await supabase
        .from("daily_progress")
        .select("total_points")
        .eq("date", new Date().toISOString().split("T")[0]);

      const totalPointsToday =
        todayStats?.reduce((sum, item) => sum + item.total_points, 0) || 0;

      return {
        totalUsers: totalUsers || 0,
        todayActiveUsers: todayActiveUsers || 0,
        totalPointsToday,
        averagePointsPerUser:
          todayActiveUsers > 0
            ? Math.round(totalPointsToday / todayActiveUsers)
            : 0,
      };
    } catch (error) {
      logger.error("Error in getGlobalStatistics:", error);
      return {
        totalUsers: 0,
        todayActiveUsers: 0,
        totalPointsToday: 0,
        averagePointsPerUser: 0,
      };
    }
  }

  /**
   * Get user rank in leaderboard
   */
  static async getUserRank(tg_id, period = "weekly") {
    try {
      let orderField;
      switch (period) {
        case "daily":
          orderField = "daily_points";
          break;
        case "all_time":
          orderField = "total_points";
          break;
        default:
          orderField = "weekly_points";
      }

      const { data: allUsers } = await supabase
        .from("user_statistics")
        .select(`tg_id, ${orderField}`)
        .gt(orderField, 0)
        .order(orderField, { ascending: false })
        .order("tg_id", { ascending: true });

      if (!allUsers) {
        return 0;
      }

      const userIndex = allUsers.findIndex((u) => u.tg_id === tg_id);
      return userIndex !== -1 ? userIndex + 1 : 0;
    } catch (error) {
      logger.error("Error in getUserRank:", error);
      return 0;
    }
  }
}
