// =====================================================
// TASK CONTROLLER - BARCHA SINTAKS XATOLARI TUZATILDI
// =====================================================
import supabase from '../config/database.js';
import { sendSuccess, sendError, sendNotFound, sendServerError } from '../utils/responses.js';

/**
 * ✅ FIXED: Update user achievements based on progress
 */
async function updateUserAchievements(tg_id) {
  try {
    // Get user's progress history for achievement calculation
    const { data: progressHistory } = await supabase
      .from('daily_progress')
      .select('date, total_points, pages_read, distance_km')
      .eq('tg_id', tg_id)
      .order('date', { ascending: false })
      .limit(30);

    if (!progressHistory || progressHistory.length === 0) {
      return;
    }

    const achievements = [];

    // ✅ Check for "consistent" achievement (7 days in a row)
    let consecutiveDays = 0;
    const today = new Date();
    
    for (let i = 0; i < Math.min(progressHistory.length, 30); i++) {
      const expectedDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const dayData = progressHistory.find(p => p.date === expectedDate);
      
      if (dayData && dayData.total_points > 0) {
        consecutiveDays++;
        if (consecutiveDays >= 21) {
          achievements.push('consistent');
          break;
        }
      } else {
        break;
      }
    }

    // ✅ Check for "reader" achievement (100+ pages total)
    const totalPages = progressHistory.reduce((sum, day) => sum + (day.pages_read || 0), 0);
    if (totalPages >= 6000) {
      achievements.push('reader');
    }

    // ✅ Check for "athlete" achievement (50+ km total)
    const totalDistance = progressHistory.reduce((sum, day) => sum + (parseFloat(day.distance_km) || 0), 0);
    if (totalDistance >= 100) {
      achievements.push('athlete');
    }

    // ✅ Check for "perfectionist" achievement (10/10 tasks for 3 days)
    const perfectDays = progressHistory.filter(day => day.total_points === 10).length;
    if (perfectDays >= 21) {
      achievements.push('perfectionist');
    }

    // ✅ Check for "early_bird" achievement (high activity for 14 days)
    const highActivityDays = progressHistory.filter(day => day.total_points >= 8).length;
    if (highActivityDays >= 21) {
      achievements.push('early_bird');
    }

    // ✅ Update user achievements if any new ones earned
    if (achievements.length > 0) {
      // Get current achievements to merge
      const { data: currentUser } = await supabase
        .from('users')
        .select('achievements')
        .eq('tg_id', tg_id)
        .single();

      const currentAchievements = currentUser?.achievements || [];
      const allAchievements = Array.from(new Set([...currentAchievements, ...achievements]));

      // Only update if there are new achievements
      if (allAchievements.length > currentAchievements.length) {
        await supabase
          .from('users')
          .update({ 
            achievements: allAchievements,
            updated_at: new Date().toISOString()
          })
          .eq('tg_id', tg_id);

        console.log(`✅ New achievements for user ${tg_id}:`, achievements);
      }
    }

  } catch (error) {
    console.error('Error updating achievements:', error);
  }
}

/**
 * ✅ FIXED: Get daily tasks for user
 * Frontend expects: GET /tasks/daily/:userId
 */
export const getDailyTasks = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const telegramId = parseInt(userId);
    if (!telegramId || telegramId <= 0) {
      return sendError(res, 'Invalid userId', 400);
    }

    // Check user approval
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_approved, name')
      .eq('tg_id', telegramId)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      return sendServerError(res, userError);
    }

    if (!user) {
      return sendNotFound(res, 'User not found');
    }

    if (!user.is_approved) {
      return sendError(res, 'User not approved yet', 403);
    }

    // Get today's progress
    const today = new Date().toISOString().split('T')[0];
    const { data: progress, error: progressError } = await supabase
      .from('daily_progress')
      .select('*')
      .eq('tg_id', telegramId)
      .eq('date', today)
      .single();

    if (progressError && progressError.code !== 'PGRST116') {
      console.error('Error getting daily progress:', progressError);
    }

    // ✅ FIXED: Task configuration matching frontend exactly
    const TASKS_CONFIG = [
      { id: 1, title: "Kunlik vird", description: "Zikr, Qur'on tilovati, ibodat", points: 50, category: "prayer", icon: "🕌", difficulty: "easy" },
      { id: 2, title: "Silai rahm", description: "Ota-ona va qarindoshlar bilan aloqa", points: 50, category: "family", icon: "❤️", difficulty: "easy" },
      { id: 3, title: "Qur'on tinglash", description: "Kamida 1/114 qism", points: 50, category: "quran", icon: "🎧", difficulty: "easy" },
      { id: 4, title: "Ehson qilish", description: "1000 so'mdan ko'p", points: 50, category: "charity", icon: "💝", difficulty: "easy" },
      { id: 5, title: "Kitob o'qish", description: "Kamida 10 bet", points: 50, category: "knowledge", icon: "📖", difficulty: "medium" },
      { id: 6, title: "Dars/Kurs", description: "Ta'lim kursi yoki dars", points: 50, category: "education", icon: "🎓", difficulty: "easy" },
      { id: 7, title: "Audio kitob", description: "Kamida 30 daqiqa", points: 50, category: "audio", icon: "🎧", difficulty: "easy" },
      { id: 8, title: "Erta uxlash", description: "21:00 - 23:00 orasida", points: 50, category: "sleep", icon: "🌙", difficulty: "easy" },
      { id: 9, title: "Erta turish", description: "03:00 - 06:00 orasida", points: 50, category: "wake", icon: "🌅", difficulty: "easy" },
      { id: 10, title: "Sport/Mashqlar", description: "Yugurish yoki mashqlar", points: 50, category: "sport", icon: "🏃‍♂️", difficulty: "medium" }
    ];

    // ✅ ASOSIY TUZATISH: Har bir vazifa uchun completion holatini ko'rsatish
    const tasks = TASKS_CONFIG.map(task => ({
      ...task,
      completed: progress ? Boolean(progress[`shart_${task.id}`]) : false,
      completedAt: progress && progress[`shart_${task.id}`] ? progress.updated_at : null
    }));

    const completedCount = progress ? progress.total_points : 0;

    // ✅ TUZATILDI: Frontend kutayotgan format (today property qo'shildi)
    const response = {
      success: true,
      date: today,
      tasks: tasks,
      completedCount: completedCount,
      totalTasks: 10,
      totalPoints: 500,  // 10 tasks * 50 points each
      earnedPoints: completedCount * 50,
      completionPercentage: Math.round((completedCount / 10) * 100),
      // Additional stats
      pages_read: progress?.pages_read || 0,
      distance_km: parseFloat(progress?.distance_km) || 0,
      // ✅ FRONTEND UCHUN: today property qo'shildi
      today: {
        completed: completedCount,
        pages_read: progress?.pages_read || 0,
        distance_km: parseFloat(progress?.distance_km) || 0
      }
    };

    console.log(`✅ Daily tasks sent for user ${telegramId}:`, {
      completed: completedCount,
      total: 10,
      date: today,
      tasksWithCompletion: tasks.filter(t => t.completed).length
    });

    return res.json(response);

  } catch (error) {
    console.error('Error in getDailyTasks:', error);
    return sendServerError(res, error);
  }
};

/**
 * ✅ FIXED: Submit daily progress
 * Frontend expects: POST /tasks/submit
 * Body: { tg_id, name?, shart_1..10, pages_read, distance_km }
 */
export const submitDailyProgress = async (req, res) => {
  try {
    const {
      tg_id,
      name,
      shart_1, shart_2, shart_3, shart_4, shart_5,
      shart_6, shart_7, shart_8, shart_9, shart_10,
      pages_read,
      distance_km
    } = req.body;

    // ✅ Validate required fields
    if (!tg_id) {
      return sendError(res, 'tg_id is required', 400);
    }

    const telegramId = parseInt(tg_id);
    if (!telegramId || telegramId <= 0) {
      return sendError(res, 'Invalid tg_id format', 400);
    }

    // ✅ Validate task values (must be 0 or 1)
    const tasks = [shart_1, shart_2, shart_3, shart_4, shart_5, shart_6, shart_7, shart_8, shart_9, shart_10];
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (task !== undefined && task !== null && ![0, 1].includes(parseInt(task))) {
        return sendError(res, `shart_${i + 1} must be 0 or 1`, 400);
      }
    }

    // ✅ Validate additional metrics
    const pagesRead = parseInt(pages_read) || 0;
    const distanceKm = parseFloat(distance_km) || 0;

    if (pagesRead < 0 || pagesRead > 10000) {
      return sendError(res, 'pages_read must be between 0 and 10000', 400);
    }

    if (distanceKm < 0 || distanceKm > 1000) {
      return sendError(res, 'distance_km must be between 0 and 1000', 400);
    }

    // ✅ Check if user exists and is approved
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('tg_id, name, is_approved')
      .eq('tg_id', telegramId)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      return sendServerError(res, userError);
    }

    if (!user) {
      return sendNotFound(res, 'User not found');
    }

    if (!user.is_approved) {
      return sendError(res, 'User not approved yet', 403);
    }

    // ✅ FIXED: Prepare progress data with proper defaults and validation
    const progressData = {
      tg_id: telegramId,
      date: new Date().toISOString().split('T')[0],
      shart_1: parseInt(shart_1) || 0,
      shart_2: parseInt(shart_2) || 0,
      shart_3: parseInt(shart_3) || 0,
      shart_4: parseInt(shart_4) || 0,
      shart_5: parseInt(shart_5) || 0,
      shart_6: parseInt(shart_6) || 0,
      shart_7: parseInt(shart_7) || 0,
      shart_8: parseInt(shart_8) || 0,
      shart_9: parseInt(shart_9) || 0,
      shart_10: parseInt(shart_10) || 0,
      pages_read: pagesRead,
      distance_km: distanceKm
    };

    // ✅ FIXED: UPSERT (insert or update) today's progress
    const { data: progress, error: progressError } = await supabase
      .from('daily_progress')
      .upsert(progressData, {
        onConflict: 'tg_id,date',
        returning: 'representation'
      })
      .select()
      .single();

    if (progressError) {
      console.error('Database error in submitProgress:', progressError);
      
      // Handle specific database errors
      if (progressError.code === '23503') {
        return sendError(res, 'User reference not found', 400);
      }
      
      return sendServerError(res, progressError);
    }

    // ✅ Update user achievements asynchronously (don't wait)
    updateUserAchievements(telegramId).catch(error => {
      console.error('Achievement update failed (non-critical):', error);
    });

    console.log(`✅ Progress saved for user ${telegramId}:`, {
      date: progress.date,
      total_points: progress.total_points,
      pages_read: progress.pages_read,
      distance_km: progress.distance_km
    });

    // ✅ FIXED: Return response in format frontend expects
    const response = {
      success: true,
      totalPoints: progress.total_points,
      message: `Ma'lumotlar muvaffaqiyatli saqlandi! ${progress.total_points}/10 vazifa bajarildi.`,
      progress: {
        date: progress.date,
        total_points: progress.total_points,
        pages_read: progress.pages_read,
        distance_km: parseFloat(progress.distance_km),
        completion_percentage: Math.round((progress.total_points / 10) * 100),
        
        // Individual task status
        tasks: {
          shart_1: progress.shart_1,
          shart_2: progress.shart_2,
          shart_3: progress.shart_3,
          shart_4: progress.shart_4,
          shart_5: progress.shart_5,
          shart_6: progress.shart_6,
          shart_7: progress.shart_7,
          shart_8: progress.shart_8,
          shart_9: progress.shart_9,
          shart_10: progress.shart_10
        },
        
        // Timestamps
        created_at: progress.created_at,
        updated_at: progress.updated_at
      }
    };

    return sendSuccess(res, response);

  } catch (error) {
    console.error('Error in submitDailyProgress:', error);
    return sendServerError(res, error);
  }
};

/**
 * ✅ NEW: Get user progress for specific date
 * GET /tasks/progress/:userId/:date
 */
export const getUserDailyProgress = async (req, res) => {
  try {
    const { userId, date } = req.params;
    
    const telegramId = parseInt(userId);
    if (!telegramId || telegramId <= 0) {
      return sendError(res, 'Invalid userId', 400);
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return sendError(res, 'Invalid date format. Use YYYY-MM-DD', 400);
    }

    // Check user exists and is approved
    const { data: user } = await supabase
      .from('users')
      .select('is_approved')
      .eq('tg_id', telegramId)
      .single();

    if (!user || !user.is_approved) {
      return sendError(res, 'User not found or not approved', 403);
    }

    // Get progress for specific date
    const { data: progress, error } = await supabase
      .from('daily_progress')
      .select('*')
      .eq('tg_id', telegramId)
      .eq('date', date)
      .single();

    if (error && error.code !== 'PGRST116') {
      return sendServerError(res, error);
    }

    // Return progress or empty state
    const response = {
      success: true,
      date: date,
      exists: !!progress,
      progress: progress ? {
        total_points: progress.total_points,
        pages_read: progress.pages_read,
        distance_km: parseFloat(progress.distance_km),
        tasks: {
          shart_1: progress.shart_1,
          shart_2: progress.shart_2,
          shart_3: progress.shart_3,
          shart_4: progress.shart_4,
          shart_5: progress.shart_5,
          shart_6: progress.shart_6,
          shart_7: progress.shart_7,
          shart_8: progress.shart_8,
          shart_9: progress.shart_9,
          shart_10: progress.shart_10
        },
        created_at: progress.created_at,
        updated_at: progress.updated_at
      } : {
        total_points: 0,
        pages_read: 0,
        distance_km: 0,
        tasks: {
          shart_1: 0, shart_2: 0, shart_3: 0, shart_4: 0, shart_5: 0,
          shart_6: 0, shart_7: 0, shart_8: 0, shart_9: 0, shart_10: 0
        }
      }
    };

    return res.json(response);

  } catch (error) {
    console.error('Error in getUserDailyProgress:', error);
    return sendServerError(res, error);
  }
};

/**
 * ✅ NEW: Get user progress history
 * GET /tasks/history/:userId?days=30
 */
export const getUserProgressHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;
    
    const telegramId = parseInt(userId);
    const daysCount = Math.min(parseInt(days) || 30, 365); // Max 1 year
    
    if (!telegramId || telegramId <= 0) {
      return sendError(res, 'Invalid userId', 400);
    }

    // Check user exists and is approved
    const { data: user } = await supabase
      .from('users')
      .select('is_approved, name')
      .eq('tg_id', telegramId)
      .single();

    if (!user || !user.is_approved) {
      return sendError(res, 'User not found or not approved', 403);
    }

    // Get progress history
    const { data: history, error } = await supabase
      .from('daily_progress')
      .select('date, total_points, pages_read, distance_km, created_at')
      .eq('tg_id', telegramId)
      .gte('date', new Date(Date.now() - daysCount * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (error) {
      return sendServerError(res, error);
    }

    // Calculate statistics
    const totalDays = history?.length || 0;
    const totalPoints = history?.reduce((sum, day) => sum + day.total_points, 0) || 0;
    const totalPages = history?.reduce((sum, day) => sum + day.pages_read, 0) || 0;
    const totalDistance = history?.reduce((sum, day) => sum + parseFloat(day.distance_km), 0) || 0;
    const perfectDays = history?.filter(day => day.total_points === 10).length || 0;

    const response = {
      success: true,
      user: {
        tg_id: telegramId,
        name: user.name
      },
      period: {
        days_requested: daysCount,
        days_with_data: totalDays
      },
      history: history || [],
      statistics: {
        total_points: totalPoints,
        total_pages: totalPages,
        total_distance: totalDistance,
        perfect_days: perfectDays,
        average_points_per_day: totalDays > 0 ? Math.round((totalPoints / totalDays) * 10) / 10 : 0,
        completion_rate: totalDays > 0 ? Math.round((totalPoints / (totalDays * 10)) * 100) : 0
      }
    };

    return res.json(response);

  } catch (error) {
    console.error('Error in getUserProgressHistory:', error);
    return sendServerError(res, error);
  }
};