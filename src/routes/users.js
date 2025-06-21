// =====================================================
// USER ROUTES - FRONTEND BILAN TO'LIQ MOS (FINAL VERSION)
// =====================================================
// File: src/routes/users.js

import express from "express";
import {
  getUserStatistics,
  getUserProfile,
  getAchievementProgress,
  getUserCalendar,
  getWeeklyStats,
  getUserMonthlyStatistics
} from "../controllers/userController.js";
import { AchievementService } from "../services/achievementService.js";
import { asyncHandler } from "../utils/responses.js";
import { sendSuccess, sendError, sendServerError } from "../utils/responses.js";

const router = express.Router();

// =====================================================
// ASOSIY USER ENDPOINTS
// =====================================================

/**
 * ✅ Get user statistics with optional calendar data
 * GET /api/users/:userId/statistics?year=2024&month=12&timezone=Asia/Tashkent
 * 
 * Frontend expects: { today, weekly, all_time, calendar? }
 * Polling: Every 15-30 seconds
 */
router.get("/:userId/statistics", asyncHandler(getUserStatistics));

/**
 * ✅ Get user profile with real-time achievements
 * GET /api/users/:userId
 * 
 * Frontend expects: { user: { id, name, achievements, stats, ... } }
 * Used by: UserProfile component
 */
router.get("/:userId", asyncHandler(getUserProfile));

/**
 * ✅ Get calendar data for specific month
 * GET /api/users/:userId/calendar?year=2024&month=12&timezone=Asia/Tashkent
 * 
 * Frontend expects: { calendar: { days: [...], monthName, year } }
 * Used by: MonthlyCalendar component
 */
router.get("/:userId/calendar", asyncHandler(getUserCalendar));

/**
 * ✅ Get weekly statistics  
 * GET /api/users/:userId/weekly?timezone=Asia/Tashkent
 * 
 * Frontend expects: { stats: { weeklyPoints, dailyPoints, ... } }
 * Used by: UserProfile weekly chart
 */
router.get("/:userId/weekly", asyncHandler(getWeeklyStats));

/**
 * ✅ Get monthly statistics (for calendar fallback)
 * GET /api/users/:userId/statistics/monthly?year=2024&month=12
 * 
 * Used by: MonthlyCalendar as fallback
 */
router.get("/:userId/statistics/monthly", asyncHandler(getUserMonthlyStatistics));

/**
 * ✅ Get real-time achievement progress
 * GET /api/users/:userId/achievements/progress
 * 
 * Frontend expects: { data: [{ id, current, max, completed, ... }] }
 * Used by: UserProfile achievements section
 */
router.get("/:userId/achievements/progress", asyncHandler(getAchievementProgress));

// =====================================================
// YANGI ENDPOINTS (FRONTEND UCHUN)
// =====================================================

/**
 * ✅ Get user rank across different metrics
 * GET /api/users/:userId/rank?period=weekly&metric=overall
 */
router.get("/:userId/rank", asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    const { period = 'weekly', metric = 'overall' } = req.query;
    const telegramId = parseInt(userId);
    
    if (!telegramId || telegramId <= 0) {
      return sendError(res, "Invalid userId", 400);
    }

    // Get user rank from leaderboard service
    const rankData = await getUserRankByMetric(telegramId, period, metric);
    
    return sendSuccess(res, {
      rank: rankData.rank || 0,
      score: rankData.score || 0,
      total_participants: rankData.total || 0,
      period,
      metric
    });
    
  } catch (error) {
    console.error("Error in getUserRank:", error);
    return sendServerError(res, error);
  }
}));

/**
 * ✅ Get achievement summary
 * GET /api/users/:userId/achievements/summary
 */
router.get("/:userId/achievements/summary", asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    const telegramId = parseInt(userId);
    
    if (!telegramId || telegramId <= 0) {
      return sendError(res, "Invalid userId", 400);
    }

    const summary = await AchievementService.getAchievementSummary(telegramId);
    return sendSuccess(res, summary);
    
  } catch (error) {
    console.error("Error in achievement summary:", error);
    return sendServerError(res, error);
  }
}));

// =====================================================
// DEBUG VA DEVELOPMENT ROUTES
// =====================================================

if (process.env.NODE_ENV !== 'production') {
  /**
   * ✅ Debug achievement status (Development only)
   * GET /api/users/:userId/debug/achievements
   */
  router.get("/:userId/debug/achievements", asyncHandler(async (req, res) => {
    try {
      const { userId } = req.params;
      const telegramId = parseInt(userId);
      
      if (!telegramId || telegramId <= 0) {
        return sendError(res, "Invalid userId", 400);
      }

      console.log(`🔍 DEBUG request for user ${telegramId} achievements`);
      
      const debugResult = await AchievementService.debugAchievements(telegramId);
      
      return sendSuccess(res, {
        debug_completed: debugResult,
        message: "Check server console for detailed debug output",
        user_id: telegramId,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("Error in debug achievements:", error);
      return sendServerError(res, error);
    }
  }));

  /**
   * ✅ Force update achievements (Development only) 
   * POST /api/users/:userId/debug/update-achievements
   */
  router.post("/:userId/debug/update-achievements", asyncHandler(async (req, res) => {
    try {
      const { userId } = req.params;
      const telegramId = parseInt(userId);
      
      if (!telegramId || telegramId <= 0) {
        return sendError(res, "Invalid userId", 400);
      }

      console.log(`🔄 FORCE UPDATE achievements for user ${telegramId}`);
      
      const newAchievements = await AchievementService.updateUserAchievements(telegramId);
      
      return sendSuccess(res, {
        force_update_completed: true,
        new_achievements: newAchievements,
        user_id: telegramId,
        timestamp: new Date().toISOString(),
        message: newAchievements.length > 0 
          ? `${newAchievements.length} new achievements earned!` 
          : "No new achievements"
      });
      
    } catch (error) {
      console.error("Error in force update achievements:", error);
      return sendServerError(res, error);
    }
  }));

  /**
   * ✅ Test all user endpoints
   * GET /api/users/:userId/debug/test-all
   */
  router.get("/:userId/debug/test-all", asyncHandler(async (req, res) => {
    try {
      const { userId } = req.params;
      const telegramId = parseInt(userId);
      
      if (!telegramId || telegramId <= 0) {
        return sendError(res, "Invalid userId", 400);
      }

      console.log(`🧪 Testing all endpoints for user ${telegramId}`);
      
      const tests = {};
      
      // Test getUserStatistics
      try {
        tests.statistics = await getUserStatistics(req, { json: () => {} });
        tests.statistics_status = "✅ Success";
      } catch (error) {
        tests.statistics_status = `❌ Failed: ${error.message}`;
      }
      
      // Test getUserProfile
      try {
        tests.profile = await getUserProfile(req, { json: () => {} });
        tests.profile_status = "✅ Success";
      } catch (error) {
        tests.profile_status = `❌ Failed: ${error.message}`;
      }
      
      // Test getAchievementProgress
      try {
        tests.achievements = await getAchievementProgress(req, { json: () => {} });
        tests.achievements_status = "✅ Success";
      } catch (error) {
        tests.achievements_status = `❌ Failed: ${error.message}`;
      }
      
      return sendSuccess(res, {
        test_results: tests,
        user_id: telegramId,
        timestamp: new Date().toISOString(),
        message: "All endpoint tests completed"
      });
      
    } catch (error) {
      console.error("Error in test-all:", error);
      return sendServerError(res, error);
    }
  }));
}

// =====================================================
// LEGACY COMPATIBILITY ROUTES
// =====================================================

/**
 * Legacy weekly stats route (redirects to new endpoint)
 * GET /api/stats/weekly/:userId -> /api/users/:userId/weekly
 */
router.get("/stats/weekly/:userId", (req, res) => {
  const userId = req.params.userId;
  const queryString = new URLSearchParams(req.query).toString();
  const redirectUrl = `/api/users/${userId}/weekly${queryString ? '?' + queryString : ''}`;
  
  console.log(`🔄 Legacy route redirect: /api/stats/weekly/${userId} -> ${redirectUrl}`);
  res.redirect(301, redirectUrl);
});

/**
 * Legacy monthly stats route
 * GET /api/stats/monthly/:userId -> /api/users/:userId/statistics/monthly
 */
router.get("/stats/monthly/:userId", (req, res) => {
  const userId = req.params.userId;
  const queryString = new URLSearchParams(req.query).toString();
  const redirectUrl = `/api/users/${userId}/statistics/monthly${queryString ? '?' + queryString : ''}`;
  
  console.log(`🔄 Legacy route redirect: /api/stats/monthly/${userId} -> ${redirectUrl}`);
  res.redirect(301, redirectUrl);
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get user rank by specific metric and period
 */
async function getUserRankByMetric(telegramId, period, metric) {
  try {
    // Import leaderboard service if available
    const { getLeaderboard } = await import("../controllers/leaderboardController.js");
    
    const leaderboardData = await getLeaderboard({
      period,
      type: metric,
      limit: 1000,
      tg_id: telegramId
    });
    
    if (leaderboardData.current_user) {
      return {
        rank: leaderboardData.current_user.rank,
        score: leaderboardData.current_user.score,
        total: leaderboardData.total_participants
      };
    }
    
    return { rank: 0, score: 0, total: 0 };
    
  } catch (error) {
    console.warn("getUserRankByMetric fallback:", error.message);
    return { rank: 0, score: 0, total: 0 };
  }
}

export default router;