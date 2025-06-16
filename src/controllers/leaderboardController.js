// =====================================================
// LEADERBOARD CONTROLLER - TO'LIQ TUZATILGAN VERSIYA  
// =====================================================
import supabase from '../config/database.js';
import { sendSuccess, sendError, sendServerError } from '../utils/responses.js';

/**
 * ✅ TO'LIQ TUZATILGAN: Get leaderboard with proper sorting and score calculation
 * GET /leaderboard?period=weekly&type=overall&limit=100&tg_id=123456789
 */
export const getLeaderboard = async (req, res) => {
  try {
    const { 
      period = 'all',      
      type = 'overall', 
      limit = 100,
      tg_id
    } = req.query;

    const limitNum = Math.min(parseInt(limit) || 100, 500);

    console.log(`🔍 Leaderboard request: period=${period}, type=${type}`);

    // ✅ ASOSIY TUZATISH 1: Field mapping to'g'ri qilish
    let orderField, scoreCalculation;
    
    // Period va Type bo'yicha to'g'ri field aniqlash
    if (period === 'daily') {
      switch (type) {
        case 'reading':
          orderField = 'daily_pages';
          scoreCalculation = 'daily_pages';
          break;
        case 'distance':
          orderField = 'daily_distance';
          scoreCalculation = 'daily_distance';
          break;
        default: // overall
          orderField = 'daily_points';
          scoreCalculation = 'daily_points';
      }
    } else if (period === 'weekly') {
      switch (type) {
        case 'reading':
          orderField = 'weekly_pages';
          scoreCalculation = 'weekly_pages';
          break;
        case 'distance':
          orderField = 'weekly_distance';
          scoreCalculation = 'weekly_distance';
          break;
        default: // overall
          orderField = 'weekly_points';
          scoreCalculation = 'weekly_points';
      }
    } else { // 'all' or 'all_time'
      switch (type) {
        case 'reading':
          orderField = 'total_pages';
          scoreCalculation = 'total_pages';
          break;
        case 'distance':
          orderField = 'total_distance';
          scoreCalculation = 'total_distance';
          break;
        default: // overall
          orderField = 'total_points';
          scoreCalculation = 'total_points';
      }
    }

    console.log(`📊 Query fields: orderField=${orderField}, scoreCalculation=${scoreCalculation}`);

    // ✅ ASOSIY TUZATISH 2: To'g'ri query with proper ordering
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
        total_distance,
        is_approved
      `)
      .eq('is_approved', true)                       // ✅ Faqat tasdiqlangan userlar
      .gt(orderField, 0)                            // ✅ Faqat 0 dan katta natijalar
      .order(orderField, { ascending: false })      // ✅ Eng kattadan kichikka
      .order('tg_id', { ascending: true })          // ✅ Teng bo'lganda ID bo'yicha
      .limit(limitNum);

    if (error) {
      console.error('❌ Database error in getLeaderboard:', error);
      return sendServerError(res, error);
    }

    console.log(`✅ Query successful: Found ${leaderboardData?.length || 0} participants`);

    if (!leaderboardData || leaderboardData.length === 0) {
      return res.json({
        success: true,
        period: period,
        type: type,
        leaderboard: [],
        current_user: null,
        total_participants: 0,
        message: 'No data found for selected period and type'
      });
    }

    // ✅ ASOSIY TUZATISH 3: To'g'ri score calculation va formatting
    const leaderboard = leaderboardData.map((user, index) => {
      // Calculate current score based on period and type
      let currentScore = 0;
      
      switch (period) {
        case 'daily':
          if (type === 'reading') {
            currentScore = user.daily_pages || 0;
          } else if (type === 'distance') {
            currentScore = parseFloat(user.daily_distance) || 0;
          } else {
            currentScore = user.daily_points || 0;
          }
          break;
          
        case 'weekly':
          if (type === 'reading') {
            currentScore = user.weekly_pages || 0;
          } else if (type === 'distance') {
            currentScore = parseFloat(user.weekly_distance) || 0;
          } else {
            currentScore = user.weekly_points || 0;
          }
          break;
          
        default: // 'all'
          if (type === 'reading') {
            currentScore = user.total_pages || 0;
          } else if (type === 'distance') {
            currentScore = parseFloat(user.total_distance) || 0;
          } else {
            currentScore = user.total_points || 0;
          }
      }

      // ✅ Format distance properly (2 decimal places)
      if (type === 'distance') {
        currentScore = Math.round(currentScore * 100) / 100;
      }

      return {
        rank: index + 1,                    
        tg_id: user.tg_id,
        name: user.name,
        username: user.username,
        photo_url: user.photo_url,
        achievements: user.achievements || [],
        
        // ✅ ALL STATISTICS (for frontend compatibility)
        total_points: user.total_points || 0,
        total_pages: user.total_pages || 0,
        total_distance: Math.round((parseFloat(user.total_distance) || 0) * 100) / 100,
        weekly_points: user.weekly_points || 0,
        weekly_pages: user.weekly_pages || 0, 
        weekly_distance: Math.round((parseFloat(user.weekly_distance) || 0) * 100) / 100,
        daily_points: user.daily_points || 0,
        daily_pages: user.daily_pages || 0,
        daily_distance: Math.round((parseFloat(user.daily_distance) || 0) * 100) / 100,
        
        // ✅ ASOSIY TUZATISH: Current score for selected period/type
        score: currentScore,
        points: currentScore,  // Alias for compatibility
        
        // Additional metadata
        current_period: period,
        current_type: type
      };
    });

    // Log top 3 for debugging
    console.log('🏆 Top 3 participants:');
    leaderboard.slice(0, 3).forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.name}: ${user.score} (${scoreCalculation})`);
    });

    // ✅ TUZATISH 4: Current user position logic
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
        console.log(`👤 Current user found in top list: rank ${current_user.rank}, score ${current_user.score}`);
      } else {
        // User not in top list - get their actual data
        const { data: userData } = await supabase
          .from('user_statistics')
          .select('*')
          .eq('tg_id', telegramId)
          .eq('is_approved', true)
          .single();
          
        if (userData) {
          // Calculate user's current score
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

          // Format distance
          if (type === 'distance') {
            userScore = Math.round(userScore * 100) / 100;
          }
          
          // Calculate actual rank by counting users with higher scores
          const { count } = await supabase
            .from('user_statistics')
            .select('tg_id', { count: 'exact' })
            .eq('is_approved', true)
            .gt(orderField, userScore || 0);
            
          current_user = {
            rank: (count || 0) + 1,
            tg_id: userData.tg_id,
            name: userData.name,
            username: userData.username,
            photo_url: userData.photo_url,
            achievements: userData.achievements || [],
            total_points: userData.total_points || 0,
            total_pages: userData.total_pages || 0,
            total_distance: Math.round((parseFloat(userData.total_distance) || 0) * 100) / 100,
            weekly_points: userData.weekly_points || 0,
            weekly_pages: userData.weekly_pages || 0,
            weekly_distance: Math.round((parseFloat(userData.weekly_distance) || 0) * 100) / 100,
            daily_points: userData.daily_points || 0,
            daily_pages: userData.daily_pages || 0,
            daily_distance: Math.round((parseFloat(userData.daily_distance) || 0) * 100) / 100,
            score: userScore,
            points: userScore,
            in_top_list: false,
            current_period: period,
            current_type: type
          };

          console.log(`👤 Current user found outside top list: rank ${current_user.rank}, score ${current_user.score}`);
        }
      }
    }

    // Get total participants for this period/type
    const { count: totalUsers } = await supabase
      .from('user_statistics')
      .select('tg_id', { count: 'exact' })
      .eq('is_approved', true)
      .gt(orderField, 0);

    // ✅ FINAL RESPONSE
    const response = {
      success: true,
      period: period,
      type: type,
      leaderboard: leaderboard,
      current_user: current_user,
      total_participants: totalUsers || 0,
      
      // ✅ Query info for debugging
      query_info: {
        order_field: orderField,
        score_calculation: scoreCalculation,
        result_count: leaderboard.length,
        ...(leaderboard.length > 0 && {
          top_score: leaderboard[0].score,
          score_range: `${leaderboard[leaderboard.length - 1]?.score || 0} - ${leaderboard[0].score}`
        })
      }
    };

    console.log(`✅ Leaderboard response prepared: ${leaderboard.length} users, period=${period}, type=${type}`);

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
// HELPER FUNCTIONS
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