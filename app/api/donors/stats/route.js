import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import Donor from "@/models/Doner.js";
import { getAuthToken } from "@/lib/authMiddleware";

// Get donor statistics and recent activity
export async function GET(req) {
  try {
    // Get session token (supports NextAuth cookie + Bearer token)
    const token = await getAuthToken(req);
    
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Please login or provide Bearer token" },
        { status: 401 }
      );
    }

    await connectDB();

    const donor = await Donor.findOne({ user_id: token.userId });
    
    if (!donor) {
      return NextResponse.json({
        error: "Donor profile not found"
      }, { status: 404 });
    }

    // Calculate stats from donor record
    const stats = {
      totalDonations: donor.total_donations || 0,
      livesSaved: (donor.total_donations || 0) * 3, // Estimate: each donation can save up to 3 lives
      acceptedRequests: donor.accepted_requests || 0,
      recentActivity: donor.recent_activity || []
    };

    return NextResponse.json(stats, { status: 200 });
  } catch (error) {
    console.error("Error fetching donor stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch donor stats" },
      { status: 500 }
    );
  }
}