import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import HospitalRequest from "@/models/HospitalRequest.js";
import User from "@/models/User.js";
import Doner from "@/models/Doner.js";
import { requireAuth } from "@/lib/authMiddleware";
import { Pusher } from "pusher";
import mongoose from "mongoose";

// Initialize Pusher
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  useTLS: true
});

/**
 * POST /api/hospital-requests/[id]/respond-sos
 * 
 * Donor responds to SOS broadcast (confirm or decline)
 * 
 * Body:
 * {
 *   action: 'confirm' | 'decline',
 *   donor_location?: { latitude, longitude }
 * }
 * 
 * Response:
 * - confirm: { success, message, responders_count, all_responders, hospital_name }
 * - decline: { success, message }
 */
export async function POST(req, { params }) {
  try {
    const requestId = params.id;

    console.log(`📞 POST /api/hospital-requests/${requestId}/respond-sos - Starting`);

    // Authenticate donor
    const auth = await requireAuth(req, { requiredRoles: ['user'] });
    if (!auth.valid) {
      console.log(`❌ respond-sos: Auth failed`);
      return auth.response;
    }

    const donorUserId = auth.userId;
    console.log(`✅ Authenticated donor: ${donorUserId}`);

    // Validate request ID
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return NextResponse.json(
        { error: "Invalid request ID" },
        { status: 400 }
      );
    }

    await connectDB();

    // Get request body
    let body = {};
    try {
      body = await req.json();
    } catch (jsonErr) {
      console.error(`❌ Failed to parse JSON body:`, jsonErr.message);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }
    
    const { action, donor_location } = body;

    if (!action || !['confirm', 'decline'].includes(action)) {
      return NextResponse.json(
        { error: "Action must be 'confirm' or 'decline'" },
        { status: 400 }
      );
    }

    // Find hospital request
    const hospitalRequest = await HospitalRequest.findById(requestId)
      .populate('hospital_id', 'name phone address fcmToken')
      .populate('bloodbank_id', 'name');

    if (!hospitalRequest) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    // Verify request is in auto_routing status (SOS broadcast)
    if (hospitalRequest.status !== 'auto_routing') {
      console.warn(`⚠️ Request ${requestId} is not in auto_routing status. Current: ${hospitalRequest.status}`);
      return NextResponse.json(
        { error: "This request is not in SOS broadcast mode" },
        { status: 400 }
      );
    }

    // Handle CONFIRM action
    if (action === 'confirm') {
      // Check if donor already responded
      const alreadyResponded = hospitalRequest.responders?.some(
        r => r.donorId.toString() === donorUserId
      );

      if (alreadyResponded) {
        return NextResponse.json(
          { error: "You have already confirmed for this request" },
          { status: 400 }
        );
      }

      // Get donor info
      const donor = await Doner.findOne({ user_id: donorUserId });
      const donorUser = await User.findById(donorUserId).select('name phone email');

      if (!donor) {
        return NextResponse.json(
          { error: "Donor profile not found" },
          { status: 404 }
        );
      }

      // Add donor to responders array
      hospitalRequest.responders = hospitalRequest.responders || [];
      hospitalRequest.responders.push({
        donorId: new mongoose.Types.ObjectId(donorUserId),
        respondedAt: new Date(),
        donor_name: donorUser?.name,
        donor_phone: donorUser?.phone,
        donor_blood_type: donor.blood_type,
        donor_location: donor_location ? {
          type: 'Point',
          coordinates: [donor_location.longitude, donor_location.latitude]
        } : null
      });

      await hospitalRequest.save();

      console.log(`✅ Donor ${donorUserId} confirmed. Total responders: ${hospitalRequest.responders.length}`);

      // Broadcast to blood bank dashboard via Pusher
      try {
        // Safely get hospital location - might be in different fields
        const hospitalLat = hospitalRequest.hospital_location?.latitude || 
                           hospitalRequest.hospital_id?.location?.latitude || 
                           hospitalRequest.hospital_id?.latitude;
        const hospitalLon = hospitalRequest.hospital_location?.longitude || 
                           hospitalRequest.hospital_id?.location?.longitude || 
                           hospitalRequest.hospital_id?.longitude;

        await pusher.trigger(`bloodbank-${hospitalRequest.bloodbank_id?._id}`, 'sos-response-update', {
          request_id: requestId,
          responders_count: hospitalRequest.responders.length,
          donor_name: donorUser?.name,
          donor_phone: donorUser?.phone,
          blood_type: donor.blood_type,
          donor_distance_km: donor_location && hospitalLat && hospitalLon ? calculateDistance(
            donor_location.latitude,
            donor_location.longitude,
            hospitalLat,
            hospitalLon
          ) : null,
          timestamp: new Date(),
          all_responders: hospitalRequest.responders.map(r => ({
            name: r.donor_name,
            phone: r.donor_phone,
            blood_type: r.donor_blood_type,
            respondedAt: r.respondedAt
          }))
        });

        console.log(`📡 Pusher notification sent to bloodbank-${hospitalRequest.bloodbank_id?._id}`);
      } catch (pusherError) {
        console.error("❌ Pusher error:", pusherError.message);
        // Don't fail the response if Pusher fails
      }

      // Send FCM notification to hospital
      try {
        const fcmTitle = `✅ ${donorUser?.name || 'Donor'} confirmed!`;
        const fcmBody = `${donorUser?.name} - Blood type ${donor.blood_type} arriving`;
        
        if (hospitalRequest.hospital_id?.fcmToken) {
          // This would normally use FCM service, but we're logging it here
          console.log(`📱 FCM to hospital: ${fcmTitle} - ${fcmBody}`);
        }
      } catch (fcmError) {
        console.error("⚠️ FCM error:", fcmError.message);
      }

      return NextResponse.json({
        success: true,
        message: "Thanks! Hospital is notified. Check in when you arrive.",
        hospital_name: hospitalRequest.hospital_id?.name,
        responders_count: hospitalRequest.responders.length,
        all_responders: hospitalRequest.responders.map(r => ({
          name: r.donor_name,
          phone: r.donor_phone,
          blood_type: r.donor_blood_type,
          respondedAt: r.respondedAt
        }))
      }, { status: 200 });
    }

    // Handle DECLINE action
    if (action === 'decline') {
      console.log(`❌ Donor ${donorUserId} declined request ${requestId}`);

      // Log decline for tracking (optional: we could record this)
      // For now, just return success
      // In a more sophisticated system, you might track declined donors to adjust weight in future broadcasts

      return NextResponse.json({
        success: true,
        message: "Request declined. Thank you for considering.",
        request_id: requestId
      }, { status: 200 });
    }

  } catch (error) {
    console.error(`❌ respond-sos error:`, error.message || error);
    console.error(`Stack trace:`, error.stack);
    return NextResponse.json(
      { 
        error: "Failed to process response", 
        details: error.message || 'Unknown error',
        errorCode: error.code || 'UNKNOWN_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * Helper function to calculate distance between two points (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(2);
}
