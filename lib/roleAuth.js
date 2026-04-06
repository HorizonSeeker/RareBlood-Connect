import { verifyAuth } from './verifyAuth';
import connectDB from '@/db/connectDB.mjs';
import User from '@/models/User.js';
import HospitalProfile from '@/models/HospitalProfile.js';

export async function authenticateRole(req, allowedRoles = [], allowIncompleteRegistration = false) {
  try {
    // Get the JWT token
    const auth = verifyAuth(req);
    
    if (!auth.valid) {
      return {
        success: false,
        error: 'Unauthorized - No valid session',
        status: 401
      };
    }

    // Connect to database
    await connectDB();

    // Find user in database
    const user = await User.findById(auth.userId);
    
    if (!user) {
      return {
        success: false,
        error: 'User not found',
        status: 404
      };
    }

    // Check if user has a role
    if (!user.role) {
      return {
        success: false,
        error: 'Access denied - Role required',
        status: 403
      };
    }

    // Check if user completed registration (skip this check if allowIncompleteRegistration is true)
    if (!allowIncompleteRegistration && !user.isRegistrationComplete) {
      return {
        success: false,
        error: 'Access denied - Registration incomplete',
        status: 403
      };
    }

    // Check if user role is in allowed roles (if specified)
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return {
        success: false,
        error: `Access denied - Required roles: ${allowedRoles.join(', ')}`,
        status: 403
      };
    }

    return {
      success: true,
      user: user,
      userId: user._id,
      role: user.role
    };
  } catch (error) {
    console.error('Role authentication error:', error);
    return {
      success: false,
      error: 'Internal server error',
      status: 500
    };
  }
}

// Helper function to create protected API route handlers
export function createProtectedRoute(allowedRoles = []) {
  return async function(req, handler) {
    const auth = await authenticateRole(req, allowedRoles);
    
    if (!auth.success) {
      return Response.json(
        { error: auth.error },
        { status: auth.status }
      );
    }
    
    // Add user info to request
    req.user = auth.user;
    req.userRole = auth.role;
    
    return handler(req);
  };
}

// Ensure a hospital account is verified per SOP12
export async function ensureHospitalVerified(userId) {
  try {
    await connectDB();
    const profile = await HospitalProfile.findOne({ user_id: userId });
    if (!profile) {
      return { success: false, error: 'Hospital profile not found', status: 404 };
    }
    if (profile.verification_status !== 'verified') {
      return { success: false, error: 'Hospital not verified', status: 403, verification_status: profile.verification_status, notes: profile.verification_notes };
    }
    return { success: true, profile };
  } catch (error) {
    console.error('Error checking hospital verification:', error);
    return { success: false, error: 'Internal server error', status: 500 };
  }
}
