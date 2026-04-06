import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/authMiddleware";
import connectDB from "@/db/connectDB.mjs";
import User from "@/models/User.js";

export async function GET(req) {
  console.log("🔵 Fetch verification status endpoint called");

  try {
    await connectDB();
    console.log("✅ Database connected");

    // Get JWT token to identify current user
    const token = await getAuthToken(req);
    console.log("🔵 Token received:", { userId: token?.userId || token?.sub, role: token?.role });

    if (!token) {
      console.log("❌ Unauthorized: No token provided");
      return NextResponse.json(
        { error: "Unauthorized - Please login or provide Bearer token" },
        { status: 401 }
      );
    }

    const userId = token.userId || token.sub;
    if (!userId) {
      console.log("❌ No valid userId found in token");
      return NextResponse.json(
        { error: "No valid userId in session" },
        { status: 401 }
      );
    }

    // Fetch user verification status
    console.log("🔵 Fetching user verification status...");
    const user = await User.findById(userId).select("verification_status");

    if (!user) {
      console.log("❌ User not found");
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    console.log("✅ Verification status fetched:", user.verification_status);

    return NextResponse.json(
      { verification_status: user.verification_status || "PENDING" },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error fetching verification status:", error);
    console.error("❌ Error stack:", error.stack);
    return NextResponse.json(
      { error: "Failed to fetch verification status", details: error.message },
      { status: 500 }
    );
  }
}
