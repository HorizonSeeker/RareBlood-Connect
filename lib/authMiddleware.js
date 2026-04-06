import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

/**
 * Get authentication token from BOTH sources:
 * 1. NextAuth session (cookie) - for browser/frontend
 * 2. Bearer token (Authorization header) - for Postman/tools
 * 
 * @param {Request} req - Next.js request object
 * @returns {Object|null} Decoded token or null if not found
 */
export async function getAuthToken(req) {
  try {
    // ✅ PRIMARY: Try NextAuth first (reads from cookie)
    console.log('[getAuthToken] 🔍 Attempting to extract token...');
    
    const nextAuthToken = await getToken({ 
      req, 
      secret: process.env.NEXTAUTH_SECRET 
    });

    if (nextAuthToken) {
      console.log("[getAuthToken] ✅ Using NextAuth session (cookie)", { 
        userId: nextAuthToken.userId || nextAuthToken.sub, 
        email: nextAuthToken.email,
        role: nextAuthToken.role 
      });
      return nextAuthToken;
    }

    console.log('[getAuthToken] ⚠️ NextAuth token not found, trying Bearer token...');

    // ✅ FALLBACK: Try Bearer token from Authorization header (for Postman)
    const authHeader = req.headers.get("authorization");
    console.log('[getAuthToken] Authorization header:', authHeader ? 'Present' : 'Missing');
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const bearerToken = authHeader.split(" ")[1];
      
      try {
        const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
        if (!secret) {
          console.warn("[getAuthToken] ❌ JWT_SECRET not configured");
          return null;
        }

        const decoded = jwt.verify(bearerToken, secret);
        console.log("[getAuthToken] ✅ Using Bearer token (Authorization header)");
        return decoded;
      } catch (err) {
        console.warn("[getAuthToken] ❌ Bearer token verification failed:", err.message);
        return null;
      }
    }

    console.warn("[getAuthToken] ⚠️  No authentication found (neither cookie nor Bearer token)");
    return null;
  } catch (error) {
    console.error("[getAuthToken] ❌ Auth retrieval error:", error.message);
    return null;
  }
}

/**
 * Unified authentication middleware for API routes
 * Supports both NextAuth (cookie) and Bearer token authentication
 * 
 * Usage:
 * ```
 * const auth = await requireAuth(req, { requiredRole: 'hospital' });
 * if (!auth.valid) return auth.response;
 * const userId = auth.userId;
 * ```
 */
export async function requireAuth(req, options = {}) {
  const { requiredRole = null, requiredRoles = null } = options;

  try {
    // ✅ Try BOTH NextAuth (cookie) and Bearer token
    const token = await getAuthToken(req);

    if (!token) {
      console.warn("[requireAuth] ❌ No token found (neither NextAuth nor Bearer token)");
      return {
        valid: false,
        response: NextResponse.json(
          { error: "Unauthorized - Please login or provide Bearer token" },
          { status: 401 }
        )
      };
    }

    const userId = token.userId || token.sub;
    const userRole = token.role || "user";

    // Validate required role(s)
    if (requiredRole && userRole !== requiredRole) {
      console.warn(`[requireAuth] ❌ Role mismatch. Expected: ${requiredRole}, Got: ${userRole}`);
      return {
        valid: false,
        response: NextResponse.json(
          { error: `Access denied. ${requiredRole} role required.` },
          { status: 403 }
        )
      };
    }

    if (requiredRoles && !requiredRoles.includes(userRole)) {
      console.warn(`[requireAuth] ❌ Role not in allowed list. Got: ${userRole}`);
      return {
        valid: false,
        response: NextResponse.json(
          { error: `Access denied. One of these roles required: ${requiredRoles.join(", ")}` },
          { status: 403 }
        )
      };
    }

    console.log(`[requireAuth] ✅ Authenticated user: ${userId} (role: ${userRole})`);

    return {
      valid: true,
      userId,
      email: token.email,
      role: userRole,
      name: token.name
    };
  } catch (error) {
    console.error("[requireAuth] ❌ Auth error:", error.message);
    return {
      valid: false,
      response: NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      )
    };
  }
}

/**
 * Optional auth - gets user info if available, but doesn't fail if not authenticated
 * Supports both NextAuth (cookie) and Bearer token authentication
 */
export async function getAuth(req) {
  try {
    // ✅ Try BOTH NextAuth (cookie) and Bearer token
    const token = await getAuthToken(req);

    if (!token) {
      return { valid: false, userId: null };
    }

    return {
      valid: true,
      userId: token.userId || token.sub,
      email: token.email,
      role: token.role || "user",
      name: token.name
    };
  } catch (error) {
    console.error("[getAuth] Error:", error.message);
    return { valid: false, userId: null };
  }
}
