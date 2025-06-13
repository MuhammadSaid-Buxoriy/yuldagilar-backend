// =====================================================
// AUTH CONTROLLER - Frontend Compatible FIXED
// =====================================================
import supabase from '../config/database.js';
import { sendSuccess, sendError, sendNotFound, sendServerError } from '../utils/responses.js';

/**
 * ✅ FIXED: Check user authentication status
 * Frontend expects: POST /auth/check with { userId }
 * Frontend sends exactly: { userId: 123456789 }
 */
export const checkUserAuth = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return sendError(res, 'userId is required', 400);
    }

    const telegramId = parseInt(userId);
    if (!telegramId || telegramId <= 0) {
      return sendError(res, 'Invalid userId format', 400);
    }

    // Query user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('tg_id, name, username, photo_url, is_registered, is_approved, achievements, created_at')
      .eq('tg_id', telegramId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Database error in checkUserAuth:', error);
      return sendServerError(res, error);
    }

    // User not found
    if (!user) {
      return sendSuccess(res, {
        isRegistered: false,
        isApproved: false,
        message: 'User needs to register first'
      });
    }

    // ✅ FIXED: User found - return status in exact frontend format
    const response = {
      isRegistered: user.is_registered,
      isApproved: user.is_approved,
      message: user.is_approved 
        ? 'User is approved and can access the app' 
        : 'User is registered but waiting for admin approval'
    };

    // ✅ FIXED: Only include user data if approved (frontend requirement)
    if (user.is_approved) {
      // ✅ Format user data exactly as frontend expects
      const nameParts = (user.name || '').split(' ');
      response.user = {
        id: user.tg_id,              // ✅ Frontend expects 'id'
        tg_id: user.tg_id,           // ✅ Also keep tg_id for backend compatibility
        first_name: nameParts[0] || user.name,    // ✅ Extract first name
        last_name: nameParts.slice(1).join(' ') || null,  // ✅ Extract last name
        name: user.name,             // ✅ Keep full name
        username: user.username,
        photo_url: user.photo_url,
        achievements: user.achievements || []
      };
    }

    return sendSuccess(res, response);

  } catch (error) {
    console.error('Error in checkUserAuth:', error);
    return sendServerError(res, error);
  }
};

/**
 * ✅ FIXED: Register new user via Telegram Bot
 * POST /auth/register
 * Body: { tg_id, name, username?, photo_url? }
 */
export const registerUser = async (req, res) => {
  try {
    const { tg_id, name, username, photo_url } = req.body;

    // Validate required fields
    if (!tg_id || !name) {
      return sendError(res, 'tg_id and name are required', 400);
    }

    const telegramId = parseInt(tg_id);
    if (!telegramId || telegramId <= 0) {
      return sendError(res, 'Invalid tg_id format', 400);
    }

    // Validate name length and format
    const cleanName = name.trim();
    if (cleanName.length < 2 || cleanName.length > 200) {
      return sendError(res, 'Name must be between 2 and 200 characters', 400);
    }

    // Basic name validation - allow letters, spaces, apostrophes, hyphens
    const nameRegex = /^[a-zA-ZА-Яа-яЁёЎўҚқҒғҲҳ\s'.-]+$/;
    if (!nameRegex.test(cleanName)) {
      return sendError(res, 'Name contains invalid characters', 400);
    }

    // Check for at least 2 words (first name + last name)
    const words = cleanName.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 2) {
      return sendError(res, 'Please provide both first and last name', 400);
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('tg_id, is_registered, is_approved, name')
      .eq('tg_id', telegramId)
      .single();

    if (existingUser) {
      return sendError(res, 'User already registered', 409, {
        user: {
          tg_id: existingUser.tg_id,
          name: existingUser.name,
          is_registered: existingUser.is_registered,
          is_approved: existingUser.is_approved
        }
      });
    }

    // ✅ FIXED: Insert new user with proper validation
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        tg_id: telegramId,
        name: cleanName,
        username: username || null,
        photo_url: photo_url || null,
        is_registered: true,
        is_approved: false,
        achievements: []
      })
      .select()
      .single();

    if (error) {
      console.error('Database error in registerUser:', error);
      
      // Handle specific database errors
      if (error.code === '23505') {
        return sendError(res, 'User already exists', 409);
      }
      
      return sendServerError(res, error);
    }

    // ✅ FIXED: Return success with user data
    return sendSuccess(res, {
      user: {
        tg_id: newUser.tg_id,
        name: newUser.name,
        username: newUser.username,
        photo_url: newUser.photo_url,
        is_registered: true,
        is_approved: false
      }
    }, 'User registered successfully. Awaiting admin approval.', 201);

  } catch (error) {
    console.error('Error in registerUser:', error);
    return sendServerError(res, error);
  }
};

/**
 * ✅ FIXED: Approve user by admin
 * POST /auth/approve/:tg_id
 */
export const approveUser = async (req, res) => {
  try {
    const { tg_id } = req.params;
    
    const telegramId = parseInt(tg_id);
    if (!telegramId || telegramId <= 0) {
      return sendError(res, 'Invalid tg_id', 400);
    }

    // Update user approval status
    const { data: user, error } = await supabase
      .from('users')
      .update({ 
        is_approved: true, 
        updated_at: new Date().toISOString() 
      })
      .eq('tg_id', telegramId)
      .eq('is_registered', true)
      .eq('is_approved', false)  // Only approve pending users
      .select()
      .single();

    if (error && error.code !== 'PGRST116') {
      return sendServerError(res, error);
    }

    if (!user) {
      return sendNotFound(res, 'User not found, already approved, or not registered');
    }

    // ✅ FIXED: Return approved user data
    return sendSuccess(res, {
      user: {
        tg_id: user.tg_id,
        name: user.name,
        username: user.username,
        is_approved: true,
        approved_at: user.updated_at
      }
    }, 'User approved successfully');

  } catch (error) {
    console.error('Error in approveUser:', error);
    return sendServerError(res, error);
  }
};

/**
 * ✅ FIXED: Reject user by admin
 * POST /auth/reject/:tg_id
 */
export const rejectUser = async (req, res) => {
  try {
    const { tg_id } = req.params;
    
    const telegramId = parseInt(tg_id);
    if (!telegramId || telegramId <= 0) {
      return sendError(res, 'Invalid tg_id', 400);
    }

    // Delete user from database (rejection = removal)
    const { data: user, error } = await supabase
      .from('users')
      .delete()
      .eq('tg_id', telegramId)
      .eq('is_approved', false)  // Only reject pending users
      .select()
      .single();

    if (error && error.code !== 'PGRST116') {
      return sendServerError(res, error);
    }

    if (!user) {
      return sendNotFound(res, 'User not found or already approved');
    }

    // ✅ FIXED: Return rejection confirmation
    return sendSuccess(res, {
      tg_id: telegramId,
      rejected_user: {
        name: user.name,
        rejected_at: new Date().toISOString()
      }
    }, 'User rejected and removed from system');

  } catch (error) {
    console.error('Error in rejectUser:', error);
    return sendServerError(res, error);
  }
};