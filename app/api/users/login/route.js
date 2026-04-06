import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import User from "@/models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

/**
 * POST /api/users/login
 * 
 * Login endpoint for user authentication
 * 
 * Input:
 * - email: string (required)
 * - password: string (required)
 * 
 * Returns:
 * - 200: { success: true, token: JWT, user: { ... } }
 * - 400: { error: "Invalid email or password" }
 * - 401: { error: "Invalid credentials" }
 * - 500: { error: "Internal server error" }
 */
export async function POST(req) {
  try {
    await connectDB();

    // Parse request body
    const body = await req.json();
    const { email, password } = body;

    // Validation: Check required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Validation: Email format
    // ✅ FIX: Use stricter email validation
    // Pattern: alphanumeric._%+- @ alphanumeric.- + 2+ letter TLD
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!emailRegex.test(email) || email.length > 254) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Find user in database
    const user = await User.findOne({ email: email.toLowerCase() });

    // Check if user exists
    if (!user) {
      console.warn(`❌ Login attempt failed: User not found - ${email}`);
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Compare password with hashed password in database
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      console.warn(`❌ Login attempt failed: Invalid password - ${email}`);
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check if user has completed registration
    if (!user.role) {
      return NextResponse.json(
        { 
          error: "User registration incomplete. Please select a role.",
          userId: user._id.toString(),
          requiresRoleSelection: true
        },
        { status: 400 }
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        name: user.name
      },
      process.env.NEXTAUTH_SECRET || "your_jwt_secret_key",
      { expiresIn: "7d" }  // Token expires in 7 days
    );

    // Update last login date
    await User.findByIdAndUpdate(user._id, {
      lastLoginDate: new Date()
    });

    console.log(`✅ Login successful: ${email} (${user.role})`);

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          phone: user.phone || null,
          address: user.address || null,
          fcmToken: user.fcmToken || null,
          verification_status: user.verification_status,
          isRegistrationComplete: user.isRegistrationComplete
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("❌ Login error:", error);

    // Handle specific MongoDB errors
    if (error.name === "MongoNetworkError") {
      return NextResponse.json(
        { error: "Database connection error" },
        { status: 500 }
      );
    }

    // Generic error response
    return NextResponse.json(
      { error: "Internal server error. Please try again later." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/users/login
 * 
 * Not allowed - only POST is supported
 */
export async function GET(req) {
  return NextResponse.json(
    { error: "Method not allowed. Use POST to login." },
    { status: 405 }
  );
}
