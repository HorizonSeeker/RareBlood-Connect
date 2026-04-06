/**
 * POST /api/donors/emergency-service
 * Update donor's emergency service status (is_critical_ready field)
 * 
 * Body: { is_critical_ready: boolean }
 */

import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/authMiddleware";
import connectDB from "@/db/connectDB.mjs";
import Donor from "@/models/Doner.js";

export async function POST(req) {
  console.log("🔵 Emergency service endpoint called");

  try {
    await connectDB();
    console.log("✅ Database connected");

    // Get JWT token to verify user is authenticated
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

    // Get request body
    const body = await req.json();
    const { is_critical_ready, fcmToken } = body;

    console.log("🔵 Request data:", { userId, is_critical_ready, fcmToken: fcmToken ? fcmToken.substring(0, 20) + '...' : null });

    if (typeof is_critical_ready !== 'boolean') {
      console.log("❌ Invalid is_critical_ready value:", is_critical_ready);
      return NextResponse.json(
        { error: "is_critical_ready must be a boolean (true/false)" },
        { status: 400 }
      );
    }

    // Find donor by user_id
    console.log("🔵 Finding donor...");
    const donor = await Donor.findOne({ user_id: userId });

    if (!donor) {
      console.log("❌ Donor not found for user:", userId);
      return NextResponse.json(
        { error: "Donor profile not found. Please complete donor registration first." },
        { status: 404 }
      );
    }

    console.log("🔵 Donor found:", { donor_id: donor._id, current_status: donor.is_critical_ready });

    // Check verification status
    if (donor.verification_status !== 'VERIFIED') {
      console.log("❌ Donor not verified:", donor.verification_status);
      return NextResponse.json(
        { error: "You must be verified as a donor before enabling emergency service" },
        { status: 403 }
      );
    }

    // Prepare update object
    const updateData = { is_critical_ready };
    if (fcmToken) {
      updateData.fcmToken = fcmToken;
      console.log(`🔵 Also saving FCM token: ${fcmToken.substring(0, 20)}...`);
    }

    // Update is_critical_ready field (and fcmToken if provided)
    console.log(`🔵 Updating emergency service status and optional FCM token...`);
    const updatedDonor = await Donor.findByIdAndUpdate(
      donor._id,
      { 
        $set: updateData
      },
      { new: true }
    );

    console.log("✅ Emergency service status updated:", {
      donor_id: updatedDonor._id,
      is_critical_ready: updatedDonor.is_critical_ready,
      fcmToken: updatedDonor.fcmToken ? updatedDonor.fcmToken.substring(0, 20) + '...' : null,
      user_id: updatedDonor.user_id,
      blood_type: updatedDonor.blood_type,
      verification_status: updatedDonor.verification_status
    });

    return NextResponse.json(
      {
        message: `Emergency service ${is_critical_ready ? 'activated' : 'deactivated'} successfully`,
        donor: {
          id: updatedDonor._id,
          is_critical_ready: updatedDonor.is_critical_ready,
          fcmToken: updatedDonor.fcmToken ? updatedDonor.fcmToken.substring(0, 20) + '...' : null,
          verification_status: updatedDonor.verification_status,
          blood_type: updatedDonor.blood_type,
          address: updatedDonor.address
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error updating emergency service status:", error);
    console.error("❌ Error stack:", error.stack);
    return NextResponse.json(
      { error: "Failed to update emergency service status", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/donors/emergency-service
 * Get current emergency service status
 */
export async function GET(req) {
  console.log("🔵 Getting emergency service status");

  try {
    await connectDB();

    const token = await getAuthToken(req);
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = token.userId || token.sub;

    // Find donor
    const donor = await Donor.findOne({ user_id: userId });

    if (!donor) {
      return NextResponse.json(
        { error: "Donor profile not found" },
        { status: 404 }
      );
    }

    console.log("✅ Emergency status retrieved:", {
      is_critical_ready: donor.is_critical_ready,
      verification_status: donor.verification_status
    });

    return NextResponse.json(
      {
        is_critical_ready: donor.is_critical_ready,
        verification_status: donor.verification_status,
        can_enable: donor.verification_status === 'VERIFIED'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error fetching emergency service status:", error);
    return NextResponse.json(
      { error: "Failed to fetch emergency service status" },
      { status: 500 }
    );
  }
}
