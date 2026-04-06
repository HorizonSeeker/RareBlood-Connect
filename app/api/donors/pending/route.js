import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/authMiddleware";
import connectDB from "@/db/connectDB.mjs";
import Donor from "@/models/Doner.js";

export async function GET(req) {
  console.log("🔵 Fetch pending donors endpoint called");

  try {
    await connectDB();
    console.log("✅ Database connected");

    // Get JWT token to verify admin access
    const token = await getAuthToken(req);
    console.log("🔵 Token received:", { userId: token?.userId || token?.sub, role: token?.role });

    if (!token) {
      console.log("❌ Unauthorized: No token provided");
      return NextResponse.json(
        { error: "Unauthorized - Please login or provide Bearer token" },
        { status: 401 }
      );
    }

    if (token.role !== "admin") {
      console.log("❌ Unauthorized: User is not admin");
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    // Fetch donors with PENDING verification status, populate user info
    console.log("🔵 Fetching pending donors...");
    const donors = await Donor.find({ verification_status: "PENDING" })
      .populate("user_id", "name email")
      .sort({ created_at: -1 });

    console.log("✅ Fetched donors:", donors.length);

    return NextResponse.json(
      { donors },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error fetching donors:", error);
    console.error("❌ Error stack:", error.stack);
    return NextResponse.json(
      { error: "Failed to fetch donors", details: error.message },
      { status: 500 }
    );
  }
}
