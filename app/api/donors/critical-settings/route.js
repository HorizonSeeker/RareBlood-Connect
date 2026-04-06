import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/authMiddleware";
import connectDB from "@/db/connectDB.mjs";
import Donor from "@/models/Doner.js";

// Update donor critical service settings (simplified - no radius)
export async function PUT(req) {
  try {
    // Get session token
    const token = await getAuthToken(req);
    // Use token.userId as canonical identifier
    if (!token) {
      console.warn('Critical-settings: unauthorized - missing token', { });
      return NextResponse.json(
        { error: "Unauthorized - Please login or provide Bearer token" },
        { status: 401 }
      );
    }

    await connectDB();

    const body = await req.json();
    const { is_critical_ready, current_location, fcmToken } = body;

    if (typeof is_critical_ready !== 'boolean') {
      return NextResponse.json(
        { error: "is_critical_ready must be a boolean" },
        { status: 400 }
      );
    }

    // Build update object
    const updateData = { is_critical_ready };
    
    // Add location if provided
    if (current_location && current_location.coordinates) {
      const [lng, lat] = current_location.coordinates;
      if (typeof lng === 'number' && typeof lat === 'number' && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
        updateData.current_location = {
          type: 'Point',
          coordinates: [lng, lat]
        };
      } else {
        console.warn('Invalid coordinates received for critical-settings:', current_location);
      }
    }

    // Add fcmToken if provided
    if (fcmToken && typeof fcmToken === 'string' && fcmToken.trim()) {
      updateData.fcmToken = fcmToken;
      console.log("🔵 [FCM] FCM Token will be saved with critical-settings update");
    }

    // Find and update donor by user_id from token.userId
    console.log("🔵 [CRITICAL] Looking for Donor with user_id:", token.userId);
    console.log("🔵 [CRITICAL] Update data:", updateData);
    
    const updatedDonor = await Donor.findOneAndUpdate(
      { user_id: token.userId },
      updateData,
      { new: true, upsert: false }
    );

    console.log("🔵 [CRITICAL] Update result:", updatedDonor ? "SUCCESS" : "FAILED - Donor not found");
    console.log("✅ [CRITICAL] Donor updated:", {
      donor_id: updatedDonor._id,
      user_id: updatedDonor.user_id,
      is_critical_ready: updatedDonor.is_critical_ready,
      current_location: updatedDonor.current_location,
      fcmToken: updatedDonor.fcmToken ? "✅ SET" : "❌ NOT SET"
    });

    if (!updatedDonor) {
      console.error("❌ [CRITICAL] Donor profile not found for user_id:", token.userId);
      return NextResponse.json(
        { error: "Donor profile not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      message: "Critical service settings updated successfully",
      is_critical_ready: updatedDonor.is_critical_ready,
      current_location: updatedDonor.current_location,
      fcmToken: updatedDonor.fcmToken ? "Set" : "Not set"
    }, { status: 200 });
  } catch (error) {
    console.error("Error updating critical service settings:", error);
    return NextResponse.json(
      { error: "Failed to update critical service settings" },
      { status: 500 }
    );
  }
}

// Get donor critical service settings (simplified)
export async function GET(req) {
  try {
    // Get session token
    const token = await getAuthToken(req);
    
    if (!token) {
      console.warn('Critical-settings GET: unauthorized - missing token');
      return NextResponse.json(
        { error: "Unauthorized - Please login or provide Bearer token" },
        { status: 401 }
      );
    }

    await connectDB();

    const donor = await Donor.findOne({ user_id: token.userId });
    
    if (!donor) {
      return NextResponse.json({
        error: "Donor profile not found",
        debug: { user_id: token.userId, email: token.email }
      }, { status: 404 });
    }
    
    return NextResponse.json({
      is_critical_ready: donor.is_critical_ready || false,
      current_location: donor.current_location || { type: 'Point', coordinates: [0, 0] }
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching critical service settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch critical service settings" },
      { status: 500 }
    );
  }
}