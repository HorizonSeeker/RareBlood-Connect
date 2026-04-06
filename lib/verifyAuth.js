import jwt from "jsonwebtoken";

/**
 * Verify JWT token from Authorization header
 * 
 * Reads Authorization header in format: "Bearer <token>"
 * Verifies token using JWT_SECRET or NEXTAUTH_SECRET
 * 
 * Usage:
 * ```
 * const auth = verifyAuth(req);
 * if (!auth.valid) {
 *   return NextResponse.json({ error: auth.error }, { status: 401 });
 * }
 * const userId = auth.userId;
 * const email = auth.email;
 * const role = auth.role;
 * ```
 * 
 * @param {Request} req - Next.js App Router request object
 * @returns {Object} { valid: boolean, userId: string, email: string, role: string, name: string, error?: string }
 */
export function verifyAuth(req) {
  try {
    // Read Authorization header (case-insensitive in Next.js)
    let authHeader = req.headers.get("authorization");
    
    // Debug logging
    if (!authHeader) {
      console.warn("❌ [verifyAuth] No authorization header found");
      console.warn("📌 Available headers:", Array.from(req.headers.entries()));
      return {
        valid: false,
        error: "No authorization header"
      };
    }

    console.log("✅ [verifyAuth] Authorization header found:", authHeader.substring(0, 20) + "...");

    // Extract token from "Bearer <token>"
    const parts = authHeader.split(" ");
    if (parts.length !== 2) {
      console.warn(`❌ [verifyAuth] Invalid header format. Expected 'Bearer <token>', got ${parts.length} parts`);
      return {
        valid: false,
        error: "Invalid authorization header format. Expected 'Bearer <token>'"
      };
    }

    const [scheme, token] = parts;

    // Check scheme (case-insensitive)
    if (scheme.toLowerCase() !== "bearer") {
      console.warn(`❌ [verifyAuth] Invalid scheme: ${scheme}`);
      return {
        valid: false,
        error: `Invalid authentication scheme: ${scheme}. Expected 'Bearer'`
      };
    }

    if (!token || token.trim() === "") {
      console.warn("❌ [verifyAuth] No token provided after Bearer");
      return {
        valid: false,
        error: "No token provided"
      };
    }

    // Get JWT secret
    const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
    
    if (!secret) {
      console.error("❌ [verifyAuth] JWT_SECRET or NEXTAUTH_SECRET not configured");
      return {
        valid: false,
        error: "Server configuration error"
      };
    }

    // Verify token signature
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
      console.log("✅ [verifyAuth] Token verified successfully for user:", decoded.userId);
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        console.warn("❌ [verifyAuth] Token expired at", jwtError.expiredAt);
        return {
          valid: false,
          error: "Token expired"
        };
      }
      if (jwtError.name === "JsonWebTokenError") {
        console.warn("❌ [verifyAuth] Invalid token:", jwtError.message);
        return {
          valid: false,
          error: "Invalid token"
        };
      }
      throw jwtError;
    }

    // Validate required fields in decoded token
    if (!decoded.userId || !decoded.email) {
      console.warn("❌ [verifyAuth] Token missing required fields: userId, email");
      return {
        valid: false,
        error: "Token missing required fields"
      };
    }

    // Return decoded user info
    return {
      valid: true,
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role || "user",
      name: decoded.name || "Unknown"
    };

  } catch (error) {
    console.error("❌ [verifyAuth] Unexpected error:", error.message, error.stack);
    return {
      valid: false,
      error: "Authentication failed: " + error.message
    };
  }
}

/**
 * Verify JWT token from Authorization header (async wrapper for compatibility)
 * 
 * @param {Request} req - Next.js request object
 * @returns {Promise<Object>} { valid: boolean, userId: string, email: string, role: string, error?: string }
 */
export async function verifyAuthAsync(req) {
  return verifyAuth(req);
}

/**
 * Get userId from request (shorthand)
 * 
 * @param {Request} req - Next.js request object
 * @returns {string|null} userId or null if invalid
 */
export function getUserId(req) {
  const auth = verifyAuth(req);
  return auth.valid ? auth.userId : null;
}

/**
 * Check if user has required role(s)
 * 
 * Usage:
 * ```
 * const auth = verifyAuth(req);
 * if (!auth.valid || !hasRole(auth.role, "hospital")) {
 *   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 * }
 * ```
 * 
 * @param {string} userRole - User's role from token
 * @param {string|string[]} requiredRoles - Required role(s)
 * @returns {boolean} true if user has required role
 */
export function hasRole(userRole, requiredRoles) {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return roles.includes(userRole);
}
