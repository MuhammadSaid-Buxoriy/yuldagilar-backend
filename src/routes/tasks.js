// =====================================================
// TASK ROUTES - Complete API FIXED
// =====================================================
import express from 'express';
import { 
  submitDailyProgress, 
  getDailyTasks, 
  getUserDailyProgress,
  getUserProgressHistory 
} from '../controllers/taskController.js';
import { asyncHandler } from '../utils/responses.js';
import { validateDailyProgress, validateUserIdParam } from '../middleware/validation.js';

const router = express.Router();

// =====================================================
// MAIN TASK ROUTES - Frontend Compatible
// =====================================================

/**
 * ✅ Submit daily progress (MAIN FRONTEND ENDPOINT)
 * POST /api/tasks/submit
 * Body: {
 *   tg_id: 123456789,
 *   name?: "Muhammad Said",  // Optional
 *   shart_1: 1, shart_2: 0, ... shart_10: 1,
 *   pages_read: 25,
 *   distance_km: 5.2
 * }
 * 
 * Frontend DailyTasks component uses this exact format
 */
router.post('/submit', validateDailyProgress, asyncHandler(submitDailyProgress));

/**
 * ✅ Get daily tasks for user
 * GET /api/tasks/daily/:userId
 * 
 * Returns: { success, date, tasks[], completedCount, totalTasks, ... }
 */
router.get('/daily/:userId', validateUserIdParam, asyncHandler(getDailyTasks));

/**
 * ✅ Get user progress for specific date
 * GET /api/tasks/progress/:userId/:date
 * 
 * Returns: { success, date, exists, progress: {...} }
 */
router.get('/progress/:userId/:date', validateUserIdParam, asyncHandler(getUserDailyProgress));

/**
 * ✅ Get user progress history
 * GET /api/tasks/history/:userId?days=30
 * 
 * Returns: { success, history[], statistics: {...} }
 */
router.get('/history/:userId', validateUserIdParam, asyncHandler(getUserProgressHistory));

// =====================================================
// DEPRECATED ROUTES (For API Evolution)
// =====================================================

/**
 * Legacy complete task endpoint
 * POST /api/tasks/complete
 * 
 * Deprecated: Returns error with migration instruction
 */
router.post('/complete', asyncHandler(async (req, res) => {
  return res.status(400).json({
    success: false,
    error: 'Deprecated endpoint',
    message: 'This endpoint is deprecated. Use /api/tasks/submit instead.',
    correct_endpoint: '/api/tasks/submit',
    migration_guide: {
      old_format: '{ userId, taskId }',
      new_format: '{ tg_id, name?, shart_1..10, pages_read, distance_km }'
    },
    documentation: 'Visit / for complete API documentation',
    timestamp: new Date().toISOString()
  });
}));

/**
 * Legacy task completion endpoint
 * PUT /api/tasks/:taskId/complete
 * 
 * Deprecated: Returns error with migration instruction
 */
router.put('/:taskId/complete', asyncHandler(async (req, res) => {
  return res.status(400).json({
    success: false,
    error: 'Deprecated endpoint',
    message: 'Individual task completion is deprecated. Use /api/tasks/submit for all tasks.',
    correct_endpoint: '/api/tasks/submit',
    migration_info: 'Submit all 10 tasks together with shart_1 through shart_10 fields',
    timestamp: new Date().toISOString()
  });
}));

// =====================================================
// UTILITY ROUTES
// =====================================================

/**
 * Get task definitions
 * GET /api/tasks/definitions
 * 
 * Returns: Static task configuration for frontend
 */
router.get('/definitions', asyncHandler(async (req, res) => {
  const TASK_DEFINITIONS = [
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

  return res.json({
    success: true,
    total_tasks: 10,
    max_daily_points: 500,
    task_definitions: TASK_DEFINITIONS,
    categories: {
      prayer: "Ibodat",
      family: "Oila",
      quran: "Qur'on",
      charity: "Ehson",
      knowledge: "Ilm",
      education: "Ta'lim",
      audio: "Audio",
      sleep: "Uyqu",
      wake: "Uyg'onish",
      sport: "Sport"
    },
    difficulty_levels: {
      easy: "Oson",
      medium: "O'rta",
      hard: "Qiyin"
    },
    timestamp: new Date().toISOString()
  });
}));

export default router;