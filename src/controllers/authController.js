// =====================================================
// AUTH CONTROLLER - RASIM MUAMMOSI VA FALLBACK AVATAR
// =====================================================
import supabase from '../config/database.js';
import { sendSuccess, sendError, sendNotFound, sendServerError } from '../utils/responses.js';

/**
 * ✅ YANGI: Generate fallback avatar URL
 */
function generateFallbackAvatar(name, size = 100) {
  try {
    const firstLetter = (name || 'U').charAt(0).toUpperCase();
    const colors = [
      '4ECDC4', // Turquoise
      '45B7D1', // Blue  
      '96CEB4', // Green
      'FFEAA7', // Yellow
      'FFB347', // Orange
      'DDA0DD', // Purple
      'FF6B6B'  // Red
    ];
    
    // Use first letter's char code to pick consistent color
    const colorIndex = firstLetter.charCodeAt(0) % colors.length;
    const backgroundColor = colors[colorIndex];
    
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(firstLetter)}&size=${size}&background=${backgroundColor}&color=fff&bold=true&format=png`;
  } catch (error) {
    console.error('Error generating fallback avatar:', error);
    return `https://ui-avatars.com/api/?name=U&size=${size}&background=4ECDC4&color=fff&bold=true&format=png`;
  }
}

/**
 * ✅ YANGI: Check if photo URL is valid and accessible
 */
async function validatePhotoUrl(photoUrl) {
  if (!photoUrl || typeof photoUrl !== 'string') {
    return false;
  }
  
  try {
    // Check if it's a proper Telegram photo URL
    if (!photoUrl.includes('telegram.org') && !photoUrl.includes('t.me')) {
      return false;
    }
    
    // Make a quick HEAD request to check if photo exists
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(photoUrl, {
      method: 'HEAD',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    return response.ok && response.headers.get('content-type')?.startsWith('image/');
  } catch (error) {
    console.warn('Photo URL validation failed:', photoUrl, error.message);
    return false;
  }
}

/**
 * ✅ TUZATILGAN: Check user authentication status with photo validation
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

    // ✅ YANGI: Photo URL validation and fallback
    let validatedPhotoUrl = user.photo_url;
    
    if (user.photo_url) {
      const isPhotoValid = await validatePhotoUrl(user.photo_url);
      if (!isPhotoValid) {
        console.warn(`Invalid photo URL for user ${telegramId}, generating fallback`);
        validatedPhotoUrl = generateFallbackAvatar(user.name);
        
        // ✅ Update database with fallback avatar
        try {
          await supabase
            .from('users')
            .update({ 
              photo_url: validatedPhotoUrl,
              updated_at: new Date().toISOString()
            })
            .eq('tg_id', telegramId);
        } catch (updateError) {
          console.error('Failed to update photo URL:', updateError);
        }
      }
    } else {
      // ✅ No photo URL - generate and save fallback
      validatedPhotoUrl = generateFallbackAvatar(user.name);
      
      try {
        await supabase
          .from('users')
          .update({ 
            photo_url: validatedPhotoUrl,
            updated_at: new Date().toISOString()
          })
          .eq('tg_id', telegramId);
      } catch (updateError) {
        console.error('Failed to save fallback photo URL:', updateError);
      }
    }

    // ✅ User found - return status in exact frontend format
    const response = {
      isRegistered: user.is_registered,
      isApproved: user.is_approved,
      message: user.is_approved 
        ? 'User is approved and can access the app' 
        : 'User is registered but waiting for admin approval'
    };

    // ✅ Only include user data if approved (frontend requirement)
    if (user.is_approved) {
      const nameParts = (user.name || '').split(' ');
      response.user = {
        id: user.tg_id,
        tg_id: user.tg_id,
        first_name: nameParts[0] || user.name,
        last_name: nameParts.slice(1).join(' ') || null,
        name: user.name,
        username: user.username,
        photo_url: validatedPhotoUrl, // ✅ Validated/fallback photo
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
 * ✅ TUZATILGAN: Register new user with photo validation
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

    // Validate name
    const cleanName = name.trim();
    if (cleanName.length < 2 || cleanName.length > 200) {
      return sendError(res, 'Name must be between 2 and 200 characters', 400);
    }

    const nameRegex = /^[a-zA-ZА-Яа-яЁёЎўҚқҒғҲҳ\s'.-]+$/;
    if (!nameRegex.test(cleanName)) {
      return sendError(res, 'Name contains invalid characters', 400);
    }

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

    // ✅ YANGI: Validate and prepare photo URL
    let finalPhotoUrl = generateFallbackAvatar(cleanName); // Default fallback
    
    if (photo_url) {
      const isPhotoValid = await validatePhotoUrl(photo_url);
      if (isPhotoValid) {
        finalPhotoUrl = photo_url; // Use provided photo if valid
        console.log(`✅ Valid photo URL for new user ${telegramId}`);
      } else {
        console.warn(`Invalid photo URL for new user ${telegramId}, using fallback`);
      }
    }

    // ✅ Insert new user with validated photo
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        tg_id: telegramId,
        name: cleanName,
        username: username || null,
        photo_url: finalPhotoUrl, // ✅ Always have a valid photo URL
        is_registered: true,
        is_approved: false,
        achievements: []
      })
      .select()
      .single();

    if (error) {
      console.error('Database error in registerUser:', error);
      
      if (error.code === '23505') {
        return sendError(res, 'User already exists', 409);
      }
      
      return sendServerError(res, error);
    }

    console.log(`✅ New user registered: ${telegramId} - ${cleanName} with photo: ${finalPhotoUrl.substring(0, 50)}...`);

    // ✅ Return success with user data
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
 * ✅ TUZATILGAN: Update user photo with validation
 */
export const updateUserPhoto = async (req, res) => {
  try {
    const { userId } = req.params;
    const { photo_url } = req.body;
    
    const telegramId = parseInt(userId);
    if (!telegramId || telegramId <= 0) {
      return sendError(res, 'Invalid userId', 400);
    }

    // ✅ Get current user to generate fallback if needed
    const { data: currentUser } = await supabase
      .from('users')
      .select('name')
      .eq('tg_id', telegramId)
      .single();

    if (!currentUser) {
      return sendNotFound(res, 'User not found');
    }

    // ✅ Validate new photo URL
    let finalPhotoUrl = generateFallbackAvatar(currentUser.name); // Default fallback
    
    if (photo_url) {
      const isPhotoValid = await validatePhotoUrl(photo_url);
      if (isPhotoValid) {
        finalPhotoUrl = photo_url;
        console.log(`✅ Valid new photo URL for user ${telegramId}`);
      } else {
        console.warn(`Invalid new photo URL for user ${telegramId}, using fallback`);
      }
    }

    // Update user photo in database
    const { data: user, error } = await supabase
      .from('users')
      .update({ 
        photo_url: finalPhotoUrl,
        updated_at: new Date().toISOString() 
      })
      .eq('tg_id', telegramId)
      .select()
      .single();

    if (error) {
      console.error('Database error in updateUserPhoto:', error);
      return sendServerError(res, error);
    }

    console.log(`✅ Photo updated for user ${telegramId}: ${finalPhotoUrl.substring(0, 50)}...`);

    return sendSuccess(res, {
      user: {
        tg_id: user.tg_id,
        name: user.name,
        username: user.username,
        photo_url: user.photo_url,
        updated_at: user.updated_at
      }
    }, 'Photo updated successfully');

  } catch (error) {
    console.error('Error in updateUserPhoto:', error);
    return sendServerError(res, error);
  }
};

/**
 * ✅ TUZATILGAN: Approve user with photo validation
 */
export const approveUser = async (req, res) => {
  try {
    const { tg_id } = req.params;
    
    const telegramId = parseInt(tg_id);
    if (!telegramId || telegramId <= 0) {
      return sendError(res, 'Invalid tg_id', 400);
    }

    // ✅ Get user with current photo for validation
    const { data: currentUser } = await supabase
      .from('users')
      .select('name, photo_url, is_registered, is_approved')
      .eq('tg_id', telegramId)
      .single();

    if (!currentUser || !currentUser.is_registered || currentUser.is_approved) {
      return sendNotFound(res, 'User not found, already approved, or not registered');
    }

    // ✅ Validate and fix photo URL if needed
    let validatedPhotoUrl = currentUser.photo_url;
    
    if (currentUser.photo_url) {
      const isPhotoValid = await validatePhotoUrl(currentUser.photo_url);
      if (!isPhotoValid) {
        validatedPhotoUrl = generateFallbackAvatar(currentUser.name);
        console.warn(`Fixing invalid photo for user ${telegramId} during approval`);
      }
    } else {
      validatedPhotoUrl = generateFallbackAvatar(currentUser.name);
    }

    // Update user approval status with validated photo
    const { data: user, error } = await supabase
      .from('users')
      .update({ 
        is_approved: true,
        photo_url: validatedPhotoUrl, // ✅ Ensure valid photo
        updated_at: new Date().toISOString() 
      })
      .eq('tg_id', telegramId)
      .eq('is_registered', true)
      .eq('is_approved', false)
      .select()
      .single();

    if (error && error.code !== 'PGRST116') {
      return sendServerError(res, error);
    }

    if (!user) {
      return sendNotFound(res, 'User not found, already approved, or not registered');
    }

    // ✅ Return approved user data
    return sendSuccess(res, {
      user: {
        tg_id: user.tg_id,
        name: user.name,
        username: user.username,
        photo_url: user.photo_url, // ✅ Validated photo
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
 * ✅ Reject user by admin (no changes needed)
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
      .eq('is_approved', false)
      .select()
      .single();

    if (error && error.code !== 'PGRST116') {
      return sendServerError(res, error);
    }

    if (!user) {
      return sendNotFound(res, 'User not found or already approved');
    }

    // ✅ Return rejection confirmation
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

/**
 * ✅ YANGI: Automatic photo refresh for all users (maintenance endpoint)
 * POST /api/auth/refresh-photos (Admin only)
 */
export const refreshAllPhotos = async (req, res) => {
  try {
    console.log('🔄 Starting automatic photo refresh for all users...');
    
    // Get all users with photo URLs
    const { data: users, error } = await supabase
      .from('users')
      .select('tg_id, name, photo_url')
      .not('photo_url', 'is', null);

    if (error) {
      return sendServerError(res, error);
    }

    let updatedCount = 0;
    let errorCount = 0;

    for (const user of users || []) {
      try {
        if (user.photo_url) {
          const isValid = await validatePhotoUrl(user.photo_url);
          
          if (!isValid) {
            const fallbackUrl = generateFallbackAvatar(user.name);
            
            await supabase
              .from('users')
              .update({ 
                photo_url: fallbackUrl,
                updated_at: new Date().toISOString()
              })
              .eq('tg_id', user.tg_id);
            
            updatedCount++;
            console.log(`🔄 Updated photo for user ${user.tg_id}: ${user.name}`);
          }
        }
      } catch (userError) {
        console.error(`❌ Failed to update photo for user ${user.tg_id}:`, userError);
        errorCount++;
      }
    }

    console.log(`✅ Photo refresh complete: ${updatedCount} updated, ${errorCount} errors`);

    return sendSuccess(res, {
      total_users: users?.length || 0,
      updated_count: updatedCount,
      error_count: errorCount,
      message: `Photo refresh completed: ${updatedCount} photos updated`
    });

  } catch (error) {
    console.error('Error in refreshAllPhotos:', error);
    return sendServerError(res, error);
  }
};