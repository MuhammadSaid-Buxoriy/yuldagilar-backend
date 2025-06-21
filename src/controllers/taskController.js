// =====================================================
// TASK CONTROLLER - TIMEZONE VA SANA MUAMMOSI TUZATILDI
// =====================================================
import supabase from '../config/database.js';
import { sendSuccess, sendError, sendNotFound, sendServerError } from '../utils/responses.js';

/**
 * ✅ YANGI: Foydalanuvchi timezone bo'yicha bugungi sanani olish
 */
function getUserTodayDate(timezone = 'Asia/Tashkent') {
  try {
    // Foydalanuvchi timezone bo'yicha bugungi sana
    const now = new Date();
    const userDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    return userDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  } catch (error) {
    console.error('Timezone error, using UTC:', error);
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * ✅ YANGI: Foydalanuvchi timezone'ini aniqlash (Frontend'dan kelishi kerak)
 */
function detectUserTimezone(req) {
  // Frontend'dan timezone yuborilishi kerak: headers yoki body orqali
  const timezone = req.headers['x-timezone'] || 
                   req.body.timezone || 
                   'Asia/Tashkent'; // O'zbekiston default
  return timezone;
}

/**
 * ✅ TUZATILGAN: Update user achievements based on progress
 */
async function updateUserAchievements(tg_id) {
  try {
    console.log(`🏆 Checking achievements for user ${tg_id}...`);
    
    // Get user's progress history for achievement calculation
    const { data: progressHistory } = await supabase
      .from('daily_progress')
      .select('date, total_points, pages_read, distance_km, shart_1, shart_2, shart_3, shart_4, shart_5, shart_6, shart_7, shart_8, shart_9, shart_10')
      .eq('tg_id', tg_id)
      .order('date', { ascending: false })
      .limit(60); // Last 60 days

    if (!progressHistory || progressHistory.length === 0) {
      console.log(`ℹ️ No progress history found for user ${tg_id}`);
      return;
    }

    const currentAchievements = [];

    // ✅ 1. FAOL (Consistent) - 21 kun ketma-ket faollik
    let consecutiveDays = 0;
    const today = new Date().toISOString().split('T')[0];
    
    for (let i = 0; i < 21; i++) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - i);
      const dateStr = targetDate.toISOString().split('T')[0];
      
      const dayData = progressHistory.find(p => p.date === dateStr);
      
      if (dayData && dayData.total_points > 0) {
        consecutiveDays++;
      } else {
        break; // Zanjir uzildi
      }
    }
    
    if (consecutiveDays >= 21) {
      currentAchievements.push('consistent');
      console.log(`✅ Achievement earned: consistent (${consecutiveDays} days)`);
    } else {
      console.log(`📊 Consistent progress: ${consecutiveDays}/21 days`);
    }

    // ✅ 2. KITOBXON (Reader) - 6000 bet o'qish
    const totalPages = progressHistory.reduce((sum, day) => sum + (day.pages_read || 0), 0);
    if (totalPages >= 6000) {
      currentAchievements.push('reader');
      console.log(`✅ Achievement earned: reader (${totalPages} pages)`);
    } else {
      console.log(`📊 Reader progress: ${totalPages}/6000 pages`);
    }

    // ✅ 3. SPORTCHI (Athlete) - 100 km yugurish
    const totalDistance = progressHistory.reduce((sum, day) => sum + (parseFloat(day.distance_km) || 0), 0);
    if (totalDistance >= 100) {
      currentAchievements.push('athlete');
      console.log(`✅ Achievement earned: athlete (${totalDistance} km)`);
    } else {
      console.log(`📊 Athlete progress: ${totalDistance}/100 km`);
    }

    // ✅ 4. UYG'OQ (Early Bird) - 21 kun ketma-ket erta turish (shart_9)
    let earlyBirdStreak = 0;
    for (let i = 0; i < 21; i++) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - i);
      const dateStr = targetDate.toISOString().split('T')[0];
      
      const dayData = progressHistory.find(p => p.date === dateStr);
      
      if (dayData && dayData.shart_9 === 1) {
        earlyBirdStreak++;
      } else {
        break; // Zanjir uzildi
      }
    }
    
    if (earlyBirdStreak >= 21) {
      currentAchievements.push('early_bird');
      console.log(`✅ Achievement earned: early_bird (${earlyBirdStreak} days)`);
    } else {
      console.log(`📊 Early bird progress: ${earlyBirdStreak}/21 days`);
    }

    // ✅ 5. OLOV (Perfectionist) - 21 kun ketma-ket 10/10 vazifa
    let perfectionistStreak = 0;
    for (let i = 0; i < 21; i++) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - i);
      const dateStr = targetDate.toISOString().split('T')[0];
      
      const dayData = progressHistory.find(p => p.date === dateStr);
      
      if (dayData) {
        // Barcha 10 ta vazifa bajarilganmi tekshirish
        const allTasksCompleted = [
          dayData.shart_1, dayData.shart_2, dayData.shart_3, dayData.shart_4, dayData.shart_5,
          dayData.shart_6, dayData.shart_7, dayData.shart_8, dayData.shart_9, dayData.shart_10
        ].every(task => task === 1);
        
        if (allTasksCompleted) {
          perfectionistStreak++;
        } else {
          break; // Zanjir uzildi
        }
      } else {
        break; // Ma'lumot yo'q
      }
    }
    
    if (perfectionistStreak >= 21) {
      currentAchievements.push('perfectionist');
      console.log(`✅ Achievement earned: perfectionist (${perfectionistStreak} days)`);
    } else {
      console.log(`📊 Perfectionist progress: ${perfectionistStreak}/21 days`);
    }

    // ✅ Update user achievements if any earned
    if (currentAchievements.length > 0) {
      // Get current achievements to merge
      const { data: currentUser } = await supabase
        .from('users')
        .select('achievements')
        .eq('tg_id', tg_id)
        .single();

      const existingAchievements = currentUser?.achievements || [];
      const allAchievements = Array.from(new Set([...existingAchievements, ...currentAchievements]));

      // Only update if there are new achievements
      if (allAchievements.length > existingAchievements.length) {
        await supabase
          .from('users')
          .update({ 
            achievements: allAchievements,
            updated_at: new Date().toISOString()
          })
          .eq('tg_id', tg_id);

        const newAchievements = currentAchievements.filter(ach => !existingAchievements.includes(ach));
        console.log(`🏆 NEW achievements for user ${tg_id}:`, newAchievements);
      }
    }

  } catch (error) {
    console.error('❌ Error updating achievements:', error);
  }
}

/**
 * ✅ TUZATILGAN: Get daily tasks for user with correct timezone
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

    // ✅ MUHIM: Foydalanuvchi timezone bo'yicha bugungi sana
    const userTimezone = detectUserTimezone(req);
    const todayDate = getUserTodayDate(userTimezone);
    
    console.log(`📅 Getting tasks for user ${telegramId} on ${todayDate} (${userTimezone})`);

    // Get today's progress
    const { data: progress, error: progressError } = await supabase
      .from('daily_progress')
      .select('*')
      .eq('tg_id', telegramId)
      .eq('date', todayDate)
      .single();

    if (progressError && progressError.code !== 'PGRST116') {
      console.error('Error getting daily progress:', progressError);
    }

    // ✅ Task configuration matching frontend exactly
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

    // ✅ Har bir vazifa uchun completion holatini ko'rsatish
    const tasks = TASKS_CONFIG.map(task => ({
      ...task,
      completed: progress ? Boolean(progress[`shart_${task.id}`]) : false,
      completedAt: progress && progress[`shart_${task.id}`] ? progress.updated_at : null
    }));

    const completedCount = progress ? progress.total_points : 0;

    // ✅ Frontend kutayotgan format
    const response = {
      success: true,
      date: todayDate, // ✅ To'g'ri sana qaytariladi
      user_timezone: userTimezone, // ✅ Debug uchun
      tasks: tasks,
      completedCount: completedCount,
      totalTasks: 10,
      totalPoints: 500,
      earnedPoints: completedCount * 50,
      completionPercentage: Math.round((completedCount / 10) * 100),
      // Additional stats
      pages_read: progress?.pages_read || 0,
      distance_km: parseFloat(progress?.distance_km) || 0,
      // ✅ FRONTEND UCHUN: today property
      today: {
        completed: completedCount,
        pages_read: progress?.pages_read || 0,
        distance_km: parseFloat(progress?.distance_km) || 0
      }
    };

    console.log(`✅ Daily tasks sent for user ${telegramId}:`, {
      completed: completedCount,
      total: 10,
      date: todayDate,
      timezone: userTimezone
    });

    return res.json(response);

  } catch (error) {
    console.error('Error in getDailyTasks:', error);
    return sendServerError(res, error);
  }
};

/**
 * ✅ TUZATILGAN: Submit daily progress with correct timezone
 */
export const submitDailyProgress = async (req, res) => {
  try {
    const {
      tg_id,
      name,
      shart_1, shart_2, shart_3, shart_4, shart_5,
      shart_6, shart_7, shart_8, shart_9, shart_10,
      pages_read,
      distance_km,
      timezone // ✅ Frontend'dan timezone qabul qilish
    } = req.body;

    // ✅ Validate required fields
    if (!tg_id) {
      return sendError(res, 'tg_id is required', 400);
    }

    const telegramId = parseInt(tg_id);
    if (!telegramId || telegramId <= 0) {
      return sendError(res, 'Invalid tg_id format', 400);
    }

    // ✅ MUHIM: Foydalanuvchi timezone bo'yicha bugungi sana
    const userTimezone = timezone || detectUserTimezone(req);
    const todayDate = getUserTodayDate(userTimezone);
    
    console.log(`💾 Submitting progress for user ${telegramId} on ${todayDate} (${userTimezone})`);

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

    // ✅ Prepare progress data with correct date
    const progressData = {
      tg_id: telegramId,
      date: todayDate, // ✅ Foydalanuvchi timezone bo'yicha sana
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

    // ✅ UPSERT (insert or update) today's progress
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
      
      if (progressError.code === '23503') {
        return sendError(res, 'User reference not found', 400);
      }
      
      return sendServerError(res, progressError);
    }

    // ✅ Update user achievements asynchronously
    updateUserAchievements(telegramId).catch(error => {
      console.error('Achievement update failed (non-critical):', error);
    });

    console.log(`✅ Progress saved for user ${telegramId}:`, {
      date: progress.date,
      total_points: progress.total_points,
      pages_read: progress.pages_read,
      distance_km: progress.distance_km,
      timezone: userTimezone
    });

    // ✅ Return response in format frontend expects
    const response = {
      success: true,
      totalPoints: progress.total_points,
      message: `Ma'lumotlar muvaffaqiyatli saqlandi! ${progress.total_points}/10 vazifa bajarildi.`,
      progress: {
        date: progress.date,
        user_timezone: userTimezone, // ✅ Debug uchun
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
 * ✅ Get user progress for specific date
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
 * ✅ Get user progress history
 */
export const getUserProgressHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;
    
    const telegramId = parseInt(userId);
    const daysCount = Math.min(parseInt(days) || 30, 365);
    
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