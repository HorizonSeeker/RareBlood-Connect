import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import User from "@/models/User.js";
import bcrypt from "bcrypt";

export async function POST(req) {
  try {
    await connectDB();

    const { email, password } = await req.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      name: email.split('@')[0], // Default name from email
      role: null, // Will be set during profile registration
      isRegistrationComplete: false,
    });

    console.log('✅ New user created:', newUser._id);

    return NextResponse.json(
      {
        message: "Account created successfully",
        user: {
          id: newUser._id,
          email: newUser.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ Signup error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
