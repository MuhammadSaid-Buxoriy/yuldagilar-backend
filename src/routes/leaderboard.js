// =====================================================
// LEADERBOARD ROUTES - Updated for Frontend
// =====================================================
import express from 'express';
import { getLeaderboard, getWeeklyStats } from '../controllers/leaderboardController.js';
import { asyncHandler } from '../utils/responses.js';

const router = express.Router();

/**
 * ✅ FIXED: Get dynamic leaderboard with tg_id support
 * GET /api/leaderboard?period=weekly&type=overall&limit=100&tg_id=123456789
 */
router.get('/', asyncHandler(getLeaderboard));

/**
 * Weekly stats compatibility route
 */
router.get('/stats/weekly/:userId', asyncHandler(getWeeklyStats));

export default router;