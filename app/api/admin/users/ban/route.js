import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/authMiddleware";
import connectDB from "@/db/connectDB.mjs";
import User from "@/models/User.js";

export async function PUT(req) {
  console.log("🔵 Ban user route called");

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

    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    console.log("🔵 Banning user:", userId);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { verification_status: "REJECTED" },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    console.log("✅ User banned successfully");

    return NextResponse.json(
      { message: "User banned successfully", user: updatedUser },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error banning user:", error);
    return NextResponse.json(
      { error: "Failed to ban user", details: error.message },
      { status: 500 }
    );
  }
}
