// =====================================================
// LEADERBOARD CONTROLLER - Frontend Compatible FIXED
// =====================================================
import supabase from '../config/database.js';
import { sendSuccess, sendError, sendServerError } from '../utils/responses.js';

/**
 * Get leaderboard - Frontend Compatible
 * GET /leaderboard?period=weekly&type=overall&limit=100&tg_id=123456789
 */
export const getLeaderboard = async (req, res) => {
  try {
    const { 
      period = 'weekly',
      type = 'overall', 
      limit = 100
    } = req.query;

    const limitNum = Math.min(parseInt(limit) || 100, 500);

    // ✅ FIXED: Dynamic score field calculation
    let scoreField, orderField;
    switch (period) {
      case 'daily':
        scoreField = 'daily_points';
        orderField = 'daily_points';
        break;
      case 'all':
      case 'all_time':
        scoreField = 'total_points';
        orderField = 'total_points';
        break;
      default: // weekly
        scoreField = 'weekly_points';
        orderField = 'weekly_points';
    }

    // ✅ FIXED: Apply type-based filtering
    if (type === 'reading') {
      orderField = period === 'weekly' ? 'weekly_pages' : 
                   period === 'daily' ? 'daily_pages' : 'total_pages';
      scoreField = orderField;
    } else if (type === 'distance') {
      orderField = period === 'weekly' ? 'weekly_distance' : 
                   period === 'daily' ? 'daily_distance' : 'total_distance';
      scoreField = orderField;
    }

    // Get leaderboard data with all required fields
    const { data: leaderboardData, error } = await supabase
      .from('user_statistics')
      .select(`
        tg_id,
        name,
        username,
        photo_url,
        achievements,
        daily_points,
        daily_pages,
        daily_distance,
        weekly_points, 
        weekly_pages,
        weekly_distance,
        total_points,
        total_pages,
        total_distance
      `)
      .gt(orderField, 0)
      .order(orderField, { ascending: false })
      .order('tg_id', { ascending: true })
      .limit(limitNum);

    if (error) {
      console.error('Database error in getLeaderboard:', error);
      return sendServerError(res, error);
    }

    // ✅ FIXED: Format exactly as frontend expects
    const leaderboard = (leaderboardData || []).map((user, index) => ({
      rank: index + 1,
      tg_id: user.tg_id,
      name: user.name,
      username: user.username,
      photo_url: user.photo_url,
      achievements: user.achievements || [],
      
      // ✅ ALL STATISTICS (Frontend needs all of them)
      total_points: user.total_points || 0,
      total_pages: user.total_pages || 0,
      total_distance: parseFloat(user.total_distance) || 0,
      weekly_points: user.weekly_points || 0,
      weekly_pages: user.weekly_pages || 0, 
      weekly_distance: parseFloat(user.weekly_distance) || 0,
      daily_points: user.daily_points || 0,
      daily_pages: user.daily_pages || 0,
      daily_distance: parseFloat(user.daily_distance) || 0,
      
      // ✅ FIXED: Dynamic score field based on period+type
      score: user[scoreField] || 0,
      
      // Additional frontend fields
      points: user[scoreField] || 0,  // Alias for score
      streak: 0,  // TODO: Calculate streak
      change: 0   // TODO: Calculate rank change
    }));

    // ✅ FIXED: Get current user position if exists
    let current_user = null;
    const userTgId = req.query.tg_id || req.headers['x-user-id'];
    
    if (userTgId) {
      const telegramId = parseInt(userTgId);
      const userIndex = leaderboard.findIndex(u => u.tg_id === telegramId);
      
      if (userIndex !== -1) {
        // User is in top list
        current_user = {
          ...leaderboard[userIndex],
          in_top_list: true
        };
      } else {
        // User not in top list - get their actual data
        const { data: userData } = await supabase
          .from('user_statistics')
          .select('*')
          .eq('tg_id', telegramId)
          .single();
          
        if (userData) {
          // Calculate actual rank
          const { count } = await supabase
            .from('user_statistics')
            .select('tg_id', { count: 'exact' })
            .gt(orderField, userData[scoreField] || 0);
            
          current_user = {
            rank: (count || 0) + 1,
            tg_id: userData.tg_id,
            name: userData.name,
            username: userData.username,
            photo_url: userData.photo_url,
            achievements: userData.achievements || [],
            total_points: userData.total_points || 0,
            total_pages: userData.total_pages || 0,
            total_distance: parseFloat(userData.total_distance) || 0,
            weekly_points: userData.weekly_points || 0,
            weekly_pages: userData.weekly_pages || 0,
            weekly_distance: parseFloat(userData.weekly_distance) || 0,
            daily_points: userData.daily_points || 0,
            daily_pages: userData.daily_pages || 0,
            daily_distance: parseFloat(userData.daily_distance) || 0,
            score: userData[scoreField] || 0,
            in_top_list: false
          };
        }
      }
    }

    // Get total participants  
    const { count: totalUsers } = await supabase
      .from('user_statistics')
      .select('tg_id', { count: 'exact' })
      .gt(orderField, 0);

    // ✅ FIXED: Response format exactly as frontend expects
    return res.json({
      success: true,
      period: period,
      leaderboard: leaderboard,
      current_user: current_user,
      total_participants: totalUsers || 0,
      // Legacy fields for backward compatibility
      currentUserRank: current_user?.rank || null,
      totalUsers: totalUsers || 0
    });

  } catch (error) {
    console.error('Error in getLeaderboard:', error);
    return sendServerError(res, error);
  }
};

/**
 * Get weekly stats for user (compatibility endpoint)
 * GET /stats/weekly/:userId
 */
export const getWeeklyStats = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const telegramId = parseInt(userId);
    if (!telegramId || telegramId <= 0) {
      return sendError(res, 'Invalid userId', 400);
    }

    // Get user statistics from view
    const { data: stats, error } = await supabase
      .from('user_statistics')
      .select('*')
      .eq('tg_id', telegramId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return sendServerError(res, error);
    }

    if (!stats) {
      return sendError(res, 'User not found', 404);
    }

    if (!stats.is_approved) {
      return sendError(res, 'User not approved yet', 403);
    }

    // Get weekly daily points
    const weeklyDailyPoints = await getWeeklyDailyPointsHelper(telegramId);

    // Format response as frontend expects
    const response = {
      success: true,
      stats: {
        weeklyPoints: stats.weekly_points || 0,
        dailyPoints: weeklyDailyPoints,
        completedTasks: stats.weekly_points || 0,  // Approximate
        totalTasks: 70,  // 7 days * 10 tasks
        streak: await calculateUserStreakHelper(telegramId),
        bestDay: getBestDayFromWeekly(weeklyDailyPoints),
        improvement: "+15%"  // TODO: Calculate actual improvement
      }
    };

    return res.json(response);

  } catch (error) {
    console.error('Error in getWeeklyStats:', error);
    return sendServerError(res, error);
  }
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get weekly daily points for chart (exactly 7 elements)
 */
async function getWeeklyDailyPointsHelper(tg_id) {
  try {
    // Get last 7 days data
    const promises = [];
    for (let i = 6; i >= 0; i--) {
      const targetDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      promises.push(
        supabase
          .from('daily_progress')
          .select('total_points')
          .eq('tg_id', tg_id)
          .eq('date', targetDate)
          .single()
      );
    }

    const results = await Promise.all(promises);
    
    // Always return exactly 7 elements
    return results.map(result => {
      if (result.error || !result.data) return 0;
      return result.data.total_points || 0;
    });

  } catch (error) {
    console.error('Error in getWeeklyDailyPointsHelper:', error);
    // Always return 7 elements even on error
    return [0, 0, 0, 0, 0, 0, 0];
  }
}

/**
 * Calculate user streak helper
 */
async function calculateUserStreakHelper(tg_id) {
  try {
    const { data, error } = await supabase
      .from('daily_progress')
      .select('date, total_points')
      .eq('tg_id', tg_id)
      .order('date', { ascending: false })
      .limit(30);

    if (error || !data) return 0;

    let streak = 0;
    
    for (let i = 0; i < data.length; i++) {
      const expectedDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const dayData = data.find(d => d.date === expectedDate);
      
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
 * Get best day from weekly points array
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