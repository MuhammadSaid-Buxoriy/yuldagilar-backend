// =====================================================
// USER ROUTES - Statistics & Profile
// =====================================================
// File: src/routes/users.js

import express from 'express';
import { getUserStatistics, getUserProfile } from '../controllers/userController.js';
import { asyncHandler } from '../utils/responses.js';

const router = express.Router();

// =====================================================
// MAIN USER ROUTES
// =====================================================

/**
 * Get user statistics
 * GET /api/users/:userId/statistics
 * 
 * Returns: { today, weekly, all_time }
 * Frontend polling every 15 seconds
 */
router.get('/:userId/statistics', asyncHandler(getUserStatistics));

/**
 * Get user profile with detailed info
 * GET /api/users/:userId
 * 
 * Returns: Complete user profile for UserProfile component
 */
router.get('/:userId', asyncHandler(getUserProfile));

export default router;