import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import BloodRequest from "@/models/BloodRequest.js";
import { getAuthToken } from "@/lib/authMiddleware";

export async function GET(req) {
  try {
    await connectDB();

    // Verify admin authentication (supports NextAuth cookie + Bearer token)
    const token = await getAuthToken(req);
    if (!token || token.role !== 'admin') {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    // Fetch pending emergency requests
    const pendingRequests = await BloodRequest.find({
      request_type: "emergency",
      status: "pending"
    })
    .populate('requested_by_user', 'name email')
    .populate('bloodbank_id', 'name')
    .sort({ requested_date: -1 });

    return NextResponse.json({
      success: true,
      data: pendingRequests
    });

  } catch (error) {
    console.error("Admin fetch emergency requests error:", error);
    return NextResponse.json(
      { error: "Failed to fetch emergency requests" },
      { status: 500 }
    );
  }
}