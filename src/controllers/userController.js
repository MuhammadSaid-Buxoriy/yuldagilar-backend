// =====================================================
// USER CONTROLLER - FRONTEND BILAN TO'LIQ MOS (FINAL VERSION)
// =====================================================
// File: src/controllers/userController.js

import supabase from "../config/database.js";
import { AchievementService } from "../services/achievementService.js";
import {
  sendSuccess,
  sendError,
  sendNotFound,
  sendServerError,
} from "../utils/responses.js";

// =====================================================
// ✅ YANGI: TIMEZONE SUPPORT FUNCTIONS
// =====================================================

/**
 * Get current week data with timezone support
 */
function getCurrentWeekData(timezone = 'UTC') {
  const now = new Date();
  const today = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  
  // Get Monday of current week
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ...
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  // Generate week dates array (Monday to Sunday)
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    weekDates.push(date.toISOString().split('T')[0]);
  }
  
  return {
    startDate: weekStart.toISOString().split('T')[0],
    endDate: weekEnd.toISOString().split('T')[0],
    weekDates,
    currentDayIndex: daysFromMonday
  };
}

/**
 * Get today's date in user timezone
 */
function getTodayInTimezone(timezone = 'UTC') {
  const now = new Date();
  const today = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  return today.toISOString().split('T')[0];
}

// =====================================================
// ✅ TUZATILGAN: CURRENT WEEK DAILY POINTS (Du-Ya format)
// =====================================================

/**
 * ✅ ASOSIY: Get current week daily points (Monday to Sunday)
 * Frontend expects: [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
 */
async function getCurrentWeekDailyPoints(tg_id, timezone = 'UTC') {
  try {
    const { weekDates } = getCurrentWeekData(timezone);
    
    console.log('📅 Backend getCurrentWeekDailyPoints:', {
      user: tg_id,
      timezone,
      weekDates,
      weekStart: weekDates[0],
      weekEnd: weekDates[6]
    });
    
    // Get data for all 7 days of current week
    const promises = weekDates.map(dateStr => 
      supabase
        .from('daily_progress')
        .select('total_points')
        .eq('tg_id', tg_id)
        .eq('date', dateStr)
        .single()
    );

    const results = await Promise.all(promises);
    
    // Convert results to points array
    const weeklyPoints = results.map((result, index) => {
      const points = (result.error || !result.data) ? 0 : (result.data.total_points || 0);
      console.log(`📅 ${weekDates[index]}: ${points} points`);
      return points;
    });

    console.log('📊 Backend weekly daily points result:', weeklyPoints);
    return weeklyPoints;

  } catch (error) {
    console.error('Error in getCurrentWeekDailyPoints:', error);
    return [0, 0, 0, 0, 0, 0, 0]; // Default: all days zero
  }
}

// =====================================================
// ✅ STATISTICS HELPER FUNCTIONS
// =====================================================

/**
 * Get today's statistics with timezone support
 */
async function getTodayStatistics(telegramId, timezone = 'UTC') {
  try {
    const todayDate = getTodayInTimezone(timezone);
    
    console.log(`📅 Getting today stats for ${todayDate} (timezone: ${timezone})`);

    const { data, error } = await supabase
      .from('daily_progress')
      .select('total_points, pages_read, distance_km')
      .eq('tg_id', telegramId)
      .eq('date', todayDate)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn("Today stats error:", error);
      return { completed: 0, pages_read: 0, distance_km: 0 };
    }

    const stats = {
      completed: data?.total_points || 0,
      pages_read: data?.pages_read || 0,
      distance_km: parseFloat(data?.distance_km) || 0
    };

    console.log(`✅ Today stats for ${telegramId}:`, stats);
    return stats;

  } catch (error) {
    console.error("Error getting today statistics:", error);
    return { completed: 0, pages_read: 0, distance_km: 0 };
  }
}

/**
 * Get all-time statistics
 */
async function getAllTimeStatistics(telegramId) {
  try {
    // Get from user_statistics view if available
    const { data: userStats, error: statsError } = await supabase
      .from('user_statistics')
      .select('total_points, total_pages, total_distance, total_days')
      .eq('tg_id', telegramId)
      .single();

    if (!statsError && userStats) {
      // Calculate streaks
      const currentStreak = await calculateUserStreak(telegramId);
      const longestStreak = await calculateLongestStreak(telegramId);
      
      return {
        total_points: userStats.total_points || 0,
        total_pages: userStats.total_pages || 0,
        total_distance: parseFloat(userStats.total_distance) || 0,
        total_days: userStats.total_days || 0,
        perfectionist_streak: currentStreak,
        early_bird_streak: 0 // TODO: Implement early bird tracking
      };
    }

    // Fallback: Calculate from daily_progress directly
    const { data, error } = await supabase
      .from('daily_progress')
      .select('total_points, pages_read, distance_km, date')
      .eq('tg_id', telegramId);

    if (error || !data) {
      return {
        total_points: 0,
        total_pages: 0,
        total_distance: 0,
        total_days: 0,
        perfectionist_streak: 0,
        early_bird_streak: 0
      };
    }

    const stats = {
      total_points: data.reduce((sum, d) => sum + (d.total_points || 0), 0),
      total_pages: data.reduce((sum, d) => sum + (d.pages_read || 0), 0),
      total_distance: data.reduce((sum, d) => sum + parseFloat(d.distance_km || 0), 0),
      total_days: new Set(data.map(d => d.date)).size,
      perfectionist_streak: await calculateUserStreak(telegramId),
      early_bird_streak: 0
    };

    console.log(`✅ All-time stats for ${telegramId}:`, stats);
    return stats;

  } catch (error) {
    console.error("Error getting all-time statistics:", error);
    return {
      total_points: 0,
      total_pages: 0,
      total_distance: 0,
      total_days: 0,
      perfectionist_streak: 0,
      early_bird_streak: 0
    };
  }
}

/**
 * Calculate user streak (consecutive days with points > 0)
 */
async function calculateUserStreak(tg_id) {
  try {
    const { data, error } = await supabase
      .from('daily_progress')
      .select('date, total_points')
      .eq('tg_id', tg_id)
      .order('date', { ascending: false })
      .limit(30);

    if (error || !data) return 0;

    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = checkDate.toISOString().split('T')[0];
      const dayData = data.find(d => d.date === dateStr);

      if (dayData && dayData.total_points > 0) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  } catch (error) {
    console.error('Error calculating streak:', error);
    return 0;
  }
}

/**
 * Calculate longest streak for user
 */
async function calculateLongestStreak(tg_id) {
  try {
    const { data, error } = await supabase
      .from('daily_progress')
      .select('date, total_points')
      .eq('tg_id', tg_id)
      .gt('total_points', 0)
      .order('date', { ascending: true });

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
    console.error('Error calculating longest streak:', error);
    return 0;
  }
}

/**
 * Get user rank in leaderboard
 */
async function getUserRank(tg_id) {
  try {
    const { data, error } = await supabase
      .from('user_statistics')
      .select('tg_id, total_points')
      .order('total_points', { ascending: false })
      .order('tg_id', { ascending: true });

    if (error || !data) return 0;

    const userIndex = data.findIndex(u => u.tg_id === tg_id);
    return userIndex !== -1 ? userIndex + 1 : 0;
  } catch (error) {
    console.error('Error getting user rank:', error);
    return 0;
  }
}

// =====================================================
// ✅ MAIN CONTROLLER FUNCTIONS
// =====================================================

/**
 * ✅ Get user statistics with timezone and calendar support
 * GET /api/users/:userId/statistics?year=2024&month=12&timezone=Asia/Tashkent
 */
export const getUserStatistics = async (req, res) => {
  try {
    const { userId } = req.params;
    const { year, month, timezone } = req.query;
    const telegramId = parseInt(userId);
    
    if (!telegramId || telegramId <= 0) {
      return sendError(res, "Invalid userId", 400);
    }

    const userTimezone = timezone || req.headers['x-timezone'] || 'UTC';
    
    console.log(`📊 Getting statistics for user ${telegramId}`, {
      year, month, timezone: userTimezone
    });

    // Check if user exists and is approved
    const { data: userCheck, error: userError } = await supabase
      .from('user_statistics')
      .select('tg_id, is_approved')
      .eq('tg_id', telegramId)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      return sendServerError(res, userError);
    }

    if (!userCheck) {
      return sendNotFound(res, "User not found");
    }

    if (!userCheck.is_approved) {
      return sendError(res, "User not approved yet", 403);
    }

    // ✅ Get all statistics
    const [todayStats, weeklyPoints, allTimeStats] = await Promise.all([
      getTodayStatistics(telegramId, userTimezone),
      getCurrentWeekDailyPoints(telegramId, userTimezone),
      getAllTimeStatistics(telegramId)
    ]);

    const response = {
      today: todayStats,
      weekly: {
        dailyPoints: weeklyPoints,
        weeklyTotal: weeklyPoints.reduce((sum, points) => sum + points, 0),
        dailyTotal: 10
      },
      all_time: allTimeStats,
      timezone: userTimezone,
      generated_at: new Date().toISOString()
    };

    // ✅ Add calendar data if requested
    if (year && month) {
      try {
        const calendarData = await getCalendarData(telegramId, parseInt(year), parseInt(month), userTimezone);
        response.calendar = calendarData;
      } catch (calendarError) {
        console.warn("Calendar data error:", calendarError);
        response.calendar = { days: [] };
      }
    }

    console.log(`✅ Statistics response for user ${telegramId}:`, {
      today_completed: todayStats.completed,
      weekly_total: response.weekly.weeklyTotal,
      all_time_points: allTimeStats.total_points
    });

    return sendSuccess(res, response);

  } catch (error) {
    console.error("Error in getUserStatistics:", error);
    return sendServerError(res, error);
  }
};

/**
 * ✅ Get user profile with real-time achievements
 * GET /api/users/:userId
 */
export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const telegramId = parseInt(userId);
    
    if (!telegramId || telegramId <= 0) {
      return sendError(res, "Invalid userId", 400);
    }

    console.log(`👤 Getting profile for user ${telegramId}`);

    // Get user with statistics
    const { data: userStats, error } = await supabase
      .from('user_statistics')
      .select('*')
      .eq('tg_id', telegramId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return sendServerError(res, error);
    }

    if (!userStats) {
      return sendNotFound(res, "User not found");
    }

    if (!userStats.is_approved) {
      return sendError(res, "User not approved yet", 403);
    }

    // ✅ Get real-time achievement progress
    console.log(`🏆 Getting real-time achievements for user: ${telegramId}`);
    let achievementProgress = [];
    let earnedAchievements = [];
    
    try {
      achievementProgress = await AchievementService.getAchievementProgress(telegramId);
      earnedAchievements = achievementProgress
        .filter(achievement => achievement.completed)
        .map(achievement => achievement.id);
    } catch (achievementError) {
      console.warn("Achievement service error:", achievementError);
    }
    
    console.log(`🏆 Earned achievements for user ${telegramId}:`, earnedAchievements);

    // ✅ Format profile response for frontend
    const nameParts = (userStats.name || "").split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const currentStreak = await calculateUserStreak(telegramId);
    const longestStreak = await calculateLongestStreak(telegramId);
    const userRank = await getUserRank(telegramId);

    const profile = {
      user: {
        id: userStats.tg_id,
        tg_id: userStats.tg_id,
        first_name: firstName,
        last_name: lastName,
        name: userStats.name,
        username: userStats.username,
        photo_url: userStats.photo_url,
        achievements: earnedAchievements,
        achievementProgress: achievementProgress,

        // Profile specific fields
        level: Math.floor((userStats.total_points || 0) / 1000) + 1,
        totalPoints: userStats.total_points || 0,
        todayPoints: userStats.daily_points || 0,
        streak: currentStreak,
        longestStreak: longestStreak,
        rank: userRank,
        joinDate: userStats.created_at,
        lastActivity: new Date().toISOString(),

        // Stats object
        stats: {
          total_points: userStats.total_points || 0,
          total_pages: userStats.total_pages || 0,
          total_distance: parseFloat(userStats.total_distance) || 0,
          total_days: userStats.total_days || 0
        }
      }
    };

    console.log(`✅ Profile response for user ${telegramId} ready with ${earnedAchievements.length} achievements`);

    return sendSuccess(res, profile);

  } catch (error) {
    console.error("Error in getUserProfile:", error);
    return sendServerError(res, error);
  }
};

/**
 * ✅ Get calendar data for specific month
 * GET /api/users/:userId/calendar?year=2024&month=12&timezone=Asia/Tashkent
 */
export const getUserCalendar = async (req, res) => {
  try {
    const { userId } = req.params;
    const { year, month, timezone } = req.query;
    const telegramId = parseInt(userId);
    
    if (!telegramId || telegramId <= 0) {
      return sendError(res, "Invalid userId", 400);
    }

    if (!year || !month) {
      return sendError(res, "Year and month parameters required", 400);
    }

    const calendarYear = parseInt(year);
    const calendarMonth = parseInt(month);
    const userTimezone = timezone || req.headers['x-timezone'] || 'UTC';

    console.log(`📅 Getting calendar for user ${telegramId}: ${calendarYear}-${calendarMonth}`);

    const calendarData = await getCalendarData(telegramId, calendarYear, calendarMonth, userTimezone);

    return sendSuccess(res, {
      calendar: calendarData,
      year: calendarYear,
      month: calendarMonth,
      timezone: userTimezone
    });

  } catch (error) {
    console.error("Error in getUserCalendar:", error);
    return sendServerError(res, error);
  }
};

/**
 * ✅ Get weekly statistics  
 * GET /api/users/:userId/weekly?timezone=Asia/Tashkent
 */
export const getWeeklyStats = async (req, res) => {
  try {
    const { userId } = req.params;
    const { timezone } = req.query;
    const telegramId = parseInt(userId);
    
    if (!telegramId || telegramId <= 0) {
      return sendError(res, "Invalid userId", 400);
    }

    const userTimezone = timezone || req.headers['x-timezone'] || 'UTC';
    
    // Get current week data
    const { currentDayIndex } = getCurrentWeekData(userTimezone);
    const weeklyPoints = await getCurrentWeekDailyPoints(telegramId, userTimezone);
    
    // Calculate weekly statistics
    const completedDaysInWeek = currentDayIndex + 1;
    const currentWeekPoints = weeklyPoints
      .slice(0, completedDaysInWeek)
      .reduce((sum, points) => sum + points, 0);
    
    const maxPossiblePoints = completedDaysInWeek * 10;
    const weeklyCompletionRate = maxPossiblePoints > 0 ? 
      Math.round((currentWeekPoints / maxPossiblePoints) * 100) : 0;

    const response = {
      stats: {
        weeklyPoints: currentWeekPoints,
        dailyPoints: weeklyPoints,
        weeklyCompletionRate: weeklyCompletionRate,
        completedDaysInWeek: completedDaysInWeek,
        maxPossibleThisWeek: maxPossiblePoints,
        streak: await calculateUserStreak(telegramId),
        bestDay: getBestDayFromWeekly(weeklyPoints.slice(0, completedDaysInWeek)),
        improvement: calculateWeeklyImprovement(weeklyPoints)
      },
      timezone: userTimezone
    };

    return sendSuccess(res, response);

  } catch (error) {
    console.error("Error in getWeeklyStats:", error);
    return sendServerError(res, error);
  }
};

/**
 * ✅ Get monthly statistics (calendar fallback)
 * GET /api/users/:userId/statistics/monthly?year=2024&month=12
 */
export const getUserMonthlyStatistics = async (req, res) => {
  try {
    const { userId } = req.params;
    const { year, month, timezone } = req.query;
    const telegramId = parseInt(userId);
    
    if (!telegramId || telegramId <= 0) {
      return sendError(res, "Invalid userId", 400);
    }

    const calendarYear = year ? parseInt(year) : new Date().getFullYear();
    const calendarMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const userTimezone = timezone || req.headers['x-timezone'] || 'UTC';

    const calendarData = await getCalendarData(telegramId, calendarYear, calendarMonth, userTimezone);
    
    // Convert to monthly statistics format
    const daily_stats = calendarData.days
      .filter(day => day.hasProgress)
      .map(day => ({
        date: day.fullDate,
        completed: day.totalPoints,
        total: 10,
        pages_read: day.pagesRead,
        distance_km: day.distanceKm
      }));

    return sendSuccess(res, {
      daily_stats,
      year: calendarYear,
      month: calendarMonth,
      timezone: userTimezone
    });

  } catch (error) {
    console.error("Error in getUserMonthlyStatistics:", error);
    return sendServerError(res, error);
  }
};

/**
 * ✅ Get real-time achievement progress
 * GET /api/users/:userId/achievements/progress
 */
export const getAchievementProgress = async (req, res) => {
  try {
    const { userId } = req.params;
    const tg_id = parseInt(userId);

    if (!tg_id || tg_id <= 0) {
      return sendError(res, "Invalid user ID", 400);
    }

    console.log(`🏆 Getting achievement progress for user: ${tg_id}`);

    const progress = await AchievementService.getAchievementProgress(tg_id);
    
    console.log(`🏆 Achievement progress result for ${tg_id}:`, {
      total_achievements: progress.length,
      completed: progress.filter(a => a.completed).length
    });
    
    return sendSuccess(res, {
      data: progress,
      user_id: tg_id,
      total_achievements: progress.length,
      completed_achievements: progress.filter(a => a.completed).length
    });

  } catch (error) {
    console.error("❌ Error in getAchievementProgress:", error);
    return sendServerError(res, error);
  }
};

// =====================================================
// ✅ HELPER FUNCTIONS FOR CALENDAR AND STATISTICS
// =====================================================

/**
 * Get calendar data for specific month
 */
async function getCalendarData(telegramId, year, month, timezone = 'UTC') {
  try {
    const daysInMonth = new Date(year, month, 0).getDate();
    
    console.log(`📅 Getting calendar data for ${year}-${month} (${daysInMonth} days)`);

    // Get all progress data for the month
    const { data, error } = await supabase
      .from('daily_progress')
      .select('date, total_points, pages_read, distance_km')
      .eq('tg_id', telegramId)
      .gte('date', `${year}-${month.toString().padStart(2, '0')}-01`)
      .lt('date', `${year}-${(month + 1).toString().padStart(2, '0')}-01`)
      .order('date');

    if (error) {
      console.warn("Calendar data query error:", error);
      return { days: [], monthName: getMonthName(month), year, month };
    }

    const progressMap = new Map();
    
    // Map progress data by day
    if (data) {
      data.forEach(row => {
        const day = new Date(row.date).getDate();
        progressMap.set(day, {
          totalPoints: row.total_points || 0,
          pagesRead: row.pages_read || 0,
          distanceKm: parseFloat(row.distance_km) || 0
        });
      });
    }

    // Generate calendar days
    const days = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayData = progressMap.get(day);
      const hasProgress = !!dayData;
      const completionPercentage = hasProgress 
        ? Math.round((dayData.totalPoints / 10) * 100) 
        : 0;

      days.push({
        date: day,
        fullDate: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
        hasProgress,
        completionPercentage,
        totalPoints: dayData?.totalPoints || 0,
        pagesRead: dayData?.pagesRead || 0,
        distanceKm: dayData?.distanceKm || 0
      });
    }

    const calendarData = {
      days,
      monthName: getMonthName(month),
      year,
      month,
      totalDaysWithProgress: days.filter(d => d.hasProgress).length,
      averageCompletion: days.length > 0 
        ? Math.round(days.reduce((sum, d) => sum + d.completionPercentage, 0) / days.length)
        : 0
    };

    console.log(`✅ Calendar data for ${year}-${month}:`, {
      totalDays: days.length,
      daysWithProgress: calendarData.totalDaysWithProgress,
      averageCompletion: calendarData.averageCompletion
    });

    return calendarData;

  } catch (error) {
    console.error("Error getting calendar data:", error);
    return {
      days: [],
      monthName: getMonthName(month),
      year,
      month,
      totalDaysWithProgress: 0,
      averageCompletion: 0
    };
  }
}

/**
 * Get month name in Uzbek
 */
function getMonthName(month) {
  const names = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'
  ];
  return names[month - 1] || 'Noma\'lum';
}

/**
 * Calculate weekly improvement percentage
 */
function calculateWeeklyImprovement(currentWeekPoints) {
  const currentAverage = currentWeekPoints.length > 0 ? 
    currentWeekPoints.reduce((sum, p) => sum + p, 0) / currentWeekPoints.length : 0;
  
  if (currentAverage >= 8) return "+20%";
  if (currentAverage >= 6) return "+10%";
  if (currentAverage >= 4) return "+5%";
  return "0%";
}

/**
 * Get best day from current week
 */
function getBestDayFromWeekly(weeklyPoints) {
  const days = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];
  
  let maxPoints = 0;
  let bestDayIndex = 0;
  
  weeklyPoints.forEach((points, index) => {
    if (points > maxPoints) {
      maxPoints = points;
      bestDayIndex = index;
    }
  });
  
  return {
    day: days[bestDayIndex] || "Dushanba",
    points: maxPoints
  };
}