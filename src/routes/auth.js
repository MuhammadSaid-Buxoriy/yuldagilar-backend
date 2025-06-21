// =====================================================
// AUTHENTICATION ROUTES - PHOTO REFRESH QO'SHILDI
// =====================================================
import express from 'express';
import { 
  checkUserAuth, 
  registerUser, 
  approveUser, 
  rejectUser, 
  updateUserPhoto,
  refreshAllPhotos
} from '../controllers/authController.js';
import { asyncHandler } from '../utils/responses.js';

const router = express.Router();

// =====================================================
// MAIN ROUTES - Frontend Compatible Format
// =====================================================

/**
 * Check user authentication status
 * POST /api/auth/check
 * Body: { userId: 123456789 }
 */
router.post('/check', asyncHandler(checkUserAuth));

/**
 * Register new user via Telegram Bot
 * POST /api/auth/register
 * Body: { tg_id, name, username?, photo_url? }
 */
router.post('/register', asyncHandler(registerUser));

/**
 * ✅ Update user photo with validation
 * PUT /api/auth/update-photo/:userId
 * Body: { photo_url: "https://..." }
 */
router.put('/update-photo/:userId', asyncHandler(updateUserPhoto));

/**
 * ✅ YANGI: Refresh all user photos (Admin/Maintenance)
 * POST /api/auth/refresh-photos
 */
router.post('/refresh-photos', asyncHandler(refreshAllPhotos));

/**
 * Approve user by admin
 * POST /api/auth/approve/:tg_id
 */
router.post('/approve/:tg_id', asyncHandler(approveUser));

/**
 * Reject user by admin  
 * POST /api/auth/reject/:tg_id
 */
router.post('/reject/:tg_id', asyncHandler(rejectUser));

// =====================================================
// BACKWARD COMPATIBILITY ROUTES
// =====================================================

/**
 * Legacy GET route support
 * GET /api/auth/check/:tg_id
 */
router.get('/check/:tg_id', asyncHandler(async (req, res) => {
  req.body = { userId: req.params.tg_id };
  return await checkUserAuth(req, res);
}));

export default router;