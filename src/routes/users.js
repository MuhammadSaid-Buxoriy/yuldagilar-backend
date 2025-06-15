// =====================================================
// USER ROUTES - Statistics & Profile + Photo Sync
// =====================================================
// File: src/routes/users.js

import express from "express";
import {
  getUserStatistics,
  getUserProfile,
  getAchievementProgress,
  syncUserPhoto,
  batchSyncPhotos,
} from "../controllers/userController.js";
import { asyncHandler } from "../utils/responses.js";

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
router.get("/:userId/statistics", asyncHandler(getUserStatistics));

/**
 * Get user profile with detailed info
 * GET /api/users/:userId
 *
 * Returns: Complete user profile for UserProfile component
 * ✅ AUTO PHOTO SYNC: Automatically syncs photo if needed
 */
router.get("/:userId", asyncHandler(getUserProfile));

router.get(
  "/:userId/achievements/progress",
  asyncHandler(getAchievementProgress)
);

// =====================================================
// ✅ YANGI: PHOTO SYNC ROUTES
// =====================================================

/**
 * Sync user profile photo from Telegram
 * POST /api/users/:userId/sync-photo
 *
 * Returns: { photo_url, source, changed }
 */
router.post("/:userId/sync-photo", asyncHandler(syncUserPhoto));

/**
 * Batch sync photos for multiple users (Admin only)
 * POST /api/users/batch-sync-photos
 * 
 * Body: { adminId }
 * Returns: { processed, successful, failed }
 */
router.post("/batch-sync-photos", asyncHandler(batchSyncPhotos));

export default router;