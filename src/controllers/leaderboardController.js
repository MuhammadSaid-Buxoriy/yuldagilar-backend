// =====================================================
// LEADERBOARD CONTROLLER - TUZATILGAN VERSIYA
// =====================================================
import supabase from '../config/database.js';
import { sendSuccess, sendError, sendServerError } from '../utils/responses.js';

/**
 * ✅ TUZATILGAN: Get leaderboard with proper sorting
 * GET /leaderboard?period=weekly&type=overall&limit=100&tg_id=123456789
 */
export const getLeaderboard = async (req, res) => {
  try {
    const { 
      period = 'all',      // ✅ TUZATISH: Default 'all' instead of 'weekly'
      type = 'overall', 
      limit = 100,
      tg_id
    } = req.query;

    const limitNum = Math.min(parseInt(limit) || 100, 500);

    // ✅ ASOSIY TUZATISH: To'g'ri score field va order field aniqlash
    let scoreField, orderField, orderDirection = 'desc';
    
    switch (period) {
      case 'daily':
        switch (type) {
          case 'reading':
            scoreField = 'daily_pages';
            orderField = 'daily_pages';
            break;
          case 'distance':
            scoreField = 'daily_distance';
            orderField = 'daily_distance';
            break;
          default: // overall
            scoreField = 'daily_points';
            orderField = 'daily_points';
        }
        break;
        
      case 'weekly':
        switch (type) {
          case 'reading':
            scoreField = 'weekly_pages';
            orderField = 'weekly_pages';
            break;
          case 'distance':
            scoreField = 'weekly_distance';
            orderField = 'weekly_distance';
            break;
          default: // overall
            scoreField = 'weekly_points';
            orderField = 'weekly_points';
        }
        break;
        
      default: // 'all' yoki 'all_time'
        switch (type) {
          case 'reading':
            scoreField = 'total_pages';
            orderField = 'total_pages';
            break;
          case 'distance':
            scoreField = 'total_distance';
            orderField = 'total_distance';
            break;
          default: // overall
            scoreField = 'total_points';
            orderField = 'total_points';
        }
    }

    console.log(`🔍 Leaderboard query: period=${period}, type=${type}, orderField=${orderField}`);

    // ✅ ASOSIY TUZATISH: To'g'ri ORDER BY bilan query
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
      .gt(orderField, 0)                    // ✅ Faqat 0 dan katta qiymatlar
      .order(orderField, { ascending: false })  // ✅ Eng kattadan kichikka
      .order('tg_id', { ascending: true })       // ✅ Teng bo'lsa ID bo'yicha
      .limit(limitNum);

    if (error) {
      console.error('❌ Database error in getLeaderboard:', error);
      return sendServerError(res, error);
    }

    console.log(`✅ Found ${leaderboardData?.length || 0} participants for ${period} ${type}`);

    // ✅ TUZATISH: To'g'ri format bilan leaderboard yaratish
    const leaderboard = (leaderboardData || []).map((user, index) => {
      // Score calculation for current type/period
      let currentScore = 0;
      switch (period) {
        case 'daily':
          currentScore = type === 'reading' ? user.daily_pages : 
                        type === 'distance' ? parseFloat(user.daily_distance) || 0 : 
                        user.daily_points;
          break;
        case 'weekly':
          currentScore = type === 'reading' ? user.weekly_pages : 
                        type === 'distance' ? parseFloat(user.weekly_distance) || 0 : 
                        user.weekly_points;
          break;
        default: // all
          currentScore = type === 'reading' ? user.total_pages : 
                        type === 'distance' ? parseFloat(user.total_distance) || 0 : 
                        user.total_points;
      }

      return {
        rank: index + 1,                    // ✅ To'g'ri rank (1, 2, 3...)
        tg_id: user.tg_id,
        name: user.name,
        username: user.username,
        photo_url: user.photo_url,
        achievements: user.achievements || [],
        
        // ✅ ALL STATISTICS (Frontend needs all)
        total_points: user.total_points || 0,
        total_pages: user.total_pages || 0,
        total_distance: parseFloat(user.total_distance) || 0,
        weekly_points: user.weekly_points || 0,
        weekly_pages: user.weekly_pages || 0, 
        weekly_distance: parseFloat(user.weekly_distance) || 0,
        daily_points: user.daily_points || 0,
        daily_pages: user.daily_pages || 0,
        daily_distance: parseFloat(user.daily_distance) || 0,
        
        // ✅ ASOSIY TUZATISH: To'g'ri score field
        score: currentScore,
        points: currentScore,  // Alias for backward compatibility
        
        // Additional fields
        streak: 0,  // TODO: Calculate if needed
        change: 0   // TODO: Calculate rank change if needed
      };
    });

    // ✅ TUZATISH: Current user position logic
    let current_user = null;
    const userTgId = tg_id || req.headers['x-user-id'];
    
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
          // Calculate actual rank by counting users with higher scores
          const { count } = await supabase
            .from('user_statistics')
            .select('tg_id', { count: 'exact' })
            .gt(orderField, userData[scoreField] || 0);
            
          // Calculate score for current user
          let userScore = 0;
          switch (period) {
            case 'daily':
              userScore = type === 'reading' ? userData.daily_pages : 
                         type === 'distance' ? parseFloat(userData.daily_distance) || 0 : 
                         userData.daily_points;
              break;
            case 'weekly':
              userScore = type === 'reading' ? userData.weekly_pages : 
                         type === 'distance' ? parseFloat(userData.weekly_distance) || 0 : 
                         userData.weekly_points;
              break;
            default: // all
              userScore = type === 'reading' ? userData.total_pages : 
                         type === 'distance' ? parseFloat(userData.total_distance) || 0 : 
                         userData.total_points;
          }
            
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
            score: userScore,
            points: userScore,
            in_top_list: false
          };
        }
      }
    }

    // Get total participants for this period/type
    const { count: totalUsers } = await supabase
      .from('user_statistics')
      .select('tg_id', { count: 'exact' })
      .gt(orderField, 0);

    // ✅ FINAL RESPONSE: To'g'ri format
    const response = {
      success: true,
      period: period,
      type: type,
      leaderboard: leaderboard,
      current_user: current_user,
      total_participants: totalUsers || 0,
      
      // Debug info (development only)
      ...(process.env.NODE_ENV !== 'production' && {
        debug: {
          query_field: orderField,
          score_field: scoreField,
          result_count: leaderboard.length,
          top_3_scores: leaderboard.slice(0, 3).map(u => u.score)
        }
      })
    };

    console.log(`✅ Leaderboard response: ${leaderboard.length} users, top score: ${leaderboard[0]?.score || 0}`);

    return res.json(response);

  } catch (error) {
    console.error('❌ Error in getLeaderboard:', error);
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

    // Get weekly daily points (exactly 7 elements)
    const weeklyDailyPoints = await getWeeklyDailyPointsHelper(telegramId);

    // Format response as frontend expects
    const response = {
      success: true,
      stats: {
        weeklyPoints: stats.weekly_points || 0,
        dailyPoints: weeklyDailyPoints,
        completedTasks: stats.weekly_points || 0,  
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
// HELPER FUNCTIONS (Same as before)
// =====================================================

/**
 * Get weekly daily points for chart (exactly 7 elements)
 */
async function getWeeklyDailyPointsHelper(tg_id) {
  try {
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
    
    return results.map(result => {
      if (result.error || !result.data) return 0;
      return result.data.total_points || 0;
    });

  } catch (error) {
    console.error('Error in getWeeklyDailyPointsHelper:', error);
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