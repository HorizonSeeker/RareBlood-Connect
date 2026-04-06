import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import connectDB from "@/db/connectDB.mjs";
import User from "@/models/User.js";
import { authOptions } from "@/app/api/auth/authOptions.js";

export async function POST(req) {
  try {
    await connectDB();

    // Get session from NextAuth (reads from cookies)
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      console.error("❌ No session found or session missing user.id");
      return NextResponse.json(
        { error: "Unauthorized - Please login first" },
        { status: 401 }
      );
    }

    console.log('🔵 User ID from session:', session.user.id);

    const { role } = await req.json();

    if (!role || !['user', 'hospital', 'bloodbank_admin'].includes(role)) {
      console.error("❌ Invalid role:", role);
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    console.log('🔵 Setting role:', role, 'for user:', session.user.id);

    // Update user role
    const user = await User.findByIdAndUpdate(
      session.user.id,
      { $set: { role } },
      { new: true }
    );

    if (!user) {
      console.error("❌ User not found in database:", session.user.id);
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    console.log('✅ User role updated:', { userId: user._id, email: user.email, role: user.role });

    return NextResponse.json(
      {
        message: "Role set successfully",
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error setting role:", error.message);
    return NextResponse.json(
      { error: "Failed to set role" },
      { status: 500 }
    );
  }
}
