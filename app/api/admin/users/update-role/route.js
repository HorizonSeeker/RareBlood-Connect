import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/authMiddleware";
import connectDB from "@/db/connectDB.mjs";
import User from "@/models/User.js";

export async function PUT(req) {
  console.log("🔵 Update user route called");

  try {
    await connectDB();
    console.log("✅ Database connected");

    // Get JWT token to verify admin access
    const token = await getAuthToken(req);
    console.log("🔵 Token received:", { userId: token?.userId || token?.sub, role: token?.role });

    // Allow both admin and bloodbank_admin roles
    if (!token) {
      console.log("❌ Unauthorized: No auth token provided");
      return NextResponse.json(
        { error: "Unauthorized - Please login or provide Bearer token" },
        { status: 401 }
      );
    }

    if (token.role !== "admin" && token.role !== "bloodbank_admin") {
      console.log("❌ Unauthorized: User is not admin. Token role:", token?.role);
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const { userId, role } = await req.json();

    if (!userId || !role) {
      return NextResponse.json(
        { error: "userId and role are required" },
        { status: 400 }
      );
    }

    // Validate role
    if (!["admin", "hospital", "bloodbank_admin", "user"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    console.log("🔵 Updating user role:", { userId, role });

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    console.log("✅ User role updated successfully");

    return NextResponse.json(
      { message: "User role updated successfully", user: updatedUser },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user", details: error.message },
      { status: 500 }
    );
  }
}
