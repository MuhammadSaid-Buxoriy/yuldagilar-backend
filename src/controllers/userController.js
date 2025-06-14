// =====================================================
// USER CONTROLLER - Frontend Compatible FIXED
// =====================================================
import supabase from "../config/database.js";
import { AchievementService } from "../services/achievementService.js";
import {
  sendSuccess,
  sendError,
  sendNotFound,
  sendServerError,
} from "../utils/responses.js";

/**
 * ✅ FIXED: Get weekly daily points array (exactly 7 elements)
 * Returns array like [7, 3, 9, 8, 4, 10, 0] for last 7 days
 */
async function getWeeklyDailyPoints(tg_id) {
  try {
    // Get last 7 days data
    const promises = [];
    for (let i = 6; i >= 0; i--) {
      const targetDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      promises.push(
        supabase
          .from("daily_progress")
          .select("total_points")
          .eq("tg_id", tg_id)
          .eq("date", targetDate)
          .single()
      );
    }

    const results = await Promise.all(promises);

    // ✅ FIXED: Always return exactly 7 elements
    return results.map((result) => {
      if (result.error || !result.data) return 0;
      return result.data.total_points || 0;
    });
  } catch (error) {
    console.error("Error in getWeeklyDailyPoints:", error);
    // ✅ Always return 7 elements even on error
    return [0, 0, 0, 0, 0, 0, 0];
  }
}

/**
 * ✅ FIXED: Calculate user streak (consecutive days with points > 0)
 */
async function calculateUserStreak(tg_id) {
  try {
    const { data, error } = await supabase
      .from("daily_progress")
      .select("date, total_points")
      .eq("tg_id", tg_id)
      .order("date", { ascending: false })
      .limit(30);

    if (error || !data) return 0;

    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = checkDate.toISOString().split("T")[0];
      const dayData = data.find((d) => d.date === dateStr);

      if (dayData && dayData.total_points > 0) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  } catch (error) {
    console.error("Error calculating streak:", error);
    return 0;
  }
}

/**
 * Calculate longest streak for user
 */
async function calculateLongestStreak(tg_id) {
  try {
    const { data, error } = await supabase
      .from("daily_progress")
      .select("date, total_points")
      .eq("tg_id", tg_id)
      .gt("total_points", 0)
      .order("date", { ascending: true });

    if (error || !data || data.length === 0) return 0;

    let longestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < data.length; i++) {
      const prevDate = new Date(data[i - 1].date);
      const currDate = new Date(data[i].date);
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
    console.error("Error calculating longest streak:", error);
    return 0;
  }
}

/**
 * Get user rank in leaderboard
 */
async function getUserRank(tg_id) {
  try {
    const { data, error } = await supabase
      .from("user_statistics")
      .select("tg_id, total_points")
      .order("total_points", { ascending: false })
      .order("tg_id", { ascending: true });

    if (error || !data) return 0;

    const userIndex = data.findIndex((u) => u.tg_id === tg_id);
    return userIndex !== -1 ? userIndex + 1 : 0;
  } catch (error) {
    console.error("Error getting user rank:", error);
    return 0;
  }
}

/**
 * Get user badges based on achievements
 */
async function getUserBadges(userStats) {
  const rank = await getUserRank(userStats.tg_id);

  const badges = [
    {
      id: 1,
      name: "Early Bird",
      icon: "🌅",
      description: "Erta turish va faol bo'lish",
      earned: (userStats.achievements || []).includes("early_bird"),
      earnedDate: userStats.created_at,
    },
    {
      id: 2,
      name: "Consistent",
      icon: "🔥",
      description: "Doimiy faol bo'lish",
      earned: (userStats.achievements || []).includes("consistent"),
      earnedDate: userStats.created_at,
    },
    {
      id: 3,
      name: "Top Performer",
      icon: "🏆",
      description: "Top 3 ga kirish",
      earned: rank <= 3 && rank > 0,
      earnedDate: null,
    },
    {
      id: 4,
      name: "Reader",
      icon: "📚",
      description: "Ko'p kitob o'qish",
      earned: (userStats.achievements || []).includes("reader"),
      earnedDate: userStats.created_at,
    },
    {
      id: 5,
      name: "Athlete",
      icon: "🏃‍♂️",
      description: "Sport bilan shug'ullanish",
      earned: (userStats.achievements || []).includes("athlete"),
      earnedDate: userStats.created_at,
    },
  ];

  return badges;
}

/**
 * ✅ FIXED: Get user statistics - Frontend Compatible Format
 * Frontend expects: GET /users/:userId/statistics
 */
export const getUserStatistics = async (req, res) => {
  try {
    const { userId } = req.params;

    const telegramId = parseInt(userId);
    if (!telegramId || telegramId <= 0) {
      return sendError(res, "Invalid userId", 400);
    }

    // Get user statistics from view
    const { data: stats, error } = await supabase
      .from("user_statistics")
      .select("*")
      .eq("tg_id", telegramId)
      .single();

    if (error && error.code !== "PGRST116") {
      return sendServerError(res, error);
    }

    if (!stats) {
      return sendNotFound(res, "User not found");
    }

    if (!stats.is_approved) {
      return sendError(res, "User not approved yet", 403);
    }

    // ✅ FIXED: Get weekly daily points (exactly 7 elements)
    const weeklyDailyPoints = await getWeeklyDailyPoints(telegramId);

    // ✅ FIXED: Format response exactly as frontend expects
    const response = {
      today: {
        completed: stats.daily_points || 0, // Frontend expects 'completed'
        pages_read: stats.daily_pages || 0,
        distance_km: parseFloat(stats.daily_distance) || 0,
      },
      weekly: {
        dailyPoints: weeklyDailyPoints, // ✅ Always 7 elements! [7,3,9,8,4,10,0]
        dailyTotal: 10, // Frontend expects this
      },
      all_time: {
        total_points: stats.total_points || 0,
        total_pages: stats.total_pages || 0,
        total_distance: parseFloat(stats.total_distance) || 0,
        total_days: stats.total_days || 0,
      },
    };

    return sendSuccess(res, response);
  } catch (error) {
    console.error("Error in getUserStatistics:", error);
    return sendServerError(res, error);
  }
};

export const getAchievementProgress = async (req, res) => {
  try {
    const { userId } = req.params;
    const tg_id = parseInt(userId);

    if (!tg_id || tg_id <= 0) {
      return sendError(res, "Invalid user ID", 400);
    }

    const progress = await AchievementService.getAchievementProgress(tg_id);
    return sendSuccess(res, progress);
  } catch (error) {
    console.error("❌ Error in getAchievementProgress:", error);
    return sendServerError(res, error);
  }
};

/**
 * ✅ FIXED: Get user profile - Frontend Compatible
 * Frontend expects: GET /users/:userId
 */
export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const telegramId = parseInt(userId);
    if (!telegramId || telegramId <= 0) {
      return sendError(res, "Invalid userId", 400);
    }

    // Get user with statistics
    const { data: userStats, error } = await supabase
      .from("user_statistics")
      .select("*")
      .eq("tg_id", telegramId)
      .single();

    if (error && error.code !== "PGRST116") {
      return sendServerError(res, error);
    }

    if (!userStats) {
      return sendNotFound(res, "User not found");
    }

    if (!userStats.is_approved) {
      return sendError(res, "User not approved yet", 403);
    }

    // ✅ FIXED: Format profile response exactly as frontend expects
    const nameParts = (userStats.name || "").split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const currentStreak = await calculateUserStreak(telegramId);
    const longestStreak = await calculateLongestStreak(telegramId);
    const userRank = await getUserRank(telegramId);
    const badges = await getUserBadges(userStats);

    const profile = {
      success: true,
      user: {
        id: userStats.tg_id,
        tg_id: userStats.tg_id, // ✅ Frontend needs both
        first_name: firstName, // ✅ Frontend format
        last_name: lastName,
        name: userStats.name, // ✅ Full name for backend compatibility
        username: userStats.username,
        photo_url: userStats.photo_url,
        avatar: userStats.photo_url, // ✅ Alternative field name
        achievements: userStats.achievements || [],

        // ✅ Profile specific fields (Frontend UserProfile component)
        level: Math.floor((userStats.total_points || 0) / 1000) + 1,
        xp: (userStats.total_points || 0) % 1000,
        xpToNextLevel: 1000 - ((userStats.total_points || 0) % 1000),
        totalPoints: userStats.total_points || 0,
        todayPoints: userStats.daily_points || 0,
        weeklyPoints: userStats.weekly_points || 0,
        monthlyPoints: userStats.total_points || 0, // TODO: Calculate monthly
        streak: currentStreak,
        longestStreak: longestStreak,
        joinDate: userStats.created_at,
        lastActivity: new Date().toISOString(),
        rank: userRank,
        badges: badges,

        // ✅ Stats object for detailed view
        stats: {
          totalPrayers: userStats.total_points || 0,
          totalQuranPages: userStats.total_pages || 0,
          totalZikr: (userStats.total_points || 0) * 100,
          totalCharity: Math.floor((userStats.total_points || 0) / 10),
          totalDistance: parseFloat(userStats.total_distance) || 0,
        },
      },
    };

    return res.json(profile);
  } catch (error) {
    console.error("Error in getUserProfile:", error);
    return sendServerError(res, error);
  }
};
