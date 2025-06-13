// =====================================================
// AUTHENTICATION ROUTES - Frontend Compatible
// =====================================================
// File: src/routes/auth.js

import express from 'express';
import { checkUserAuth, registerUser, approveUser, rejectUser } from '../controllers/authController.js';
import { asyncHandler } from '../utils/responses.js';

const router = express.Router();

// =====================================================
// MAIN ROUTES - Frontend Compatible Format
// =====================================================

/**
 * Check user authentication status
 * POST /api/auth/check
 * Body: { userId: 123456789 }
 * 
 * Frontend expects this exact format!
 */
router.post('/check', asyncHandler(checkUserAuth));

/**
 * Register new user via Telegram Bot
 * POST /api/auth/register
 * Body: { tg_id, name, username?, photo_url? }
 */
router.post('/register', asyncHandler(registerUser));

/**
 * Approve user by admin
 * POST /api/auth/approve/:tg_id
 * Admin only endpoint
 */
router.post('/approve/:tg_id', asyncHandler(approveUser));

/**
 * Reject user by admin  
 * POST /api/auth/reject/:tg_id
 * Admin only endpoint
 */
router.post('/reject/:tg_id', asyncHandler(rejectUser));

// =====================================================
// BACKWARD COMPATIBILITY ROUTES
// =====================================================

/**
 * Legacy GET route support
 * GET /api/auth/check/:tg_id
 * Converts to POST format for compatibility
 */
router.get('/check/:tg_id', asyncHandler(async (req, res) => {
  // Convert GET to POST format
  req.body = { userId: req.params.tg_id };
  return await checkUserAuth(req, res);
}));

export default router;