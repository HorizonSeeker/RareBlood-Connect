import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import BloodRequest from "@/models/BloodRequest.js";
import User from "@/models/User.js";
import Donor from "@/models/Doner.js";
import admin from '@/config/firebase.mjs';
import { getToken } from "next-auth/jwt";

export async function POST(req) {
  try {
    await connectDB();
    
    // Get user token (optional for emergency requests)
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    const body = await req.json();
    const {
      patientName,
      contactNumber,
      bloodType,
      unitsRequired,
      hospitalLocation,
      emergencyDetails,
      latitude,
      longitude,
      selectedBloodBankId,
      isLoggedIn,
      userEmail,
      requesterName,
      requesterEmail,
      relationToPatient
    } = body;

    // Validate required fields
    if (!patientName || !contactNumber || !bloodType || !unitsRequired || !hospitalLocation || !emergencyDetails || !selectedBloodBankId) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Additional validation for non-logged-in users
    if (!isLoggedIn && (!requesterName || !requesterEmail || !relationToPatient)) {
      return NextResponse.json(
        { error: "Requester information is required for emergency access" },
        { status: 400 }
      );
    }

    let user = null;
    
    // Handle logged-in users
    if (token && isLoggedIn) {
      user = await User.findOne({ email: token.email });
      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }
    }

    // Create emergency blood request
    const emergencyRequestData = {
      bloodbank_id: selectedBloodBankId,
      blood_type: bloodType,
      units_required: parseInt(unitsRequired),
      request_type: "emergency",
      status: "pending",
      emergency_contact_name: patientName,
      emergency_contact_mobile: contactNumber,
      emergency_details: emergencyDetails,
      hospital_location: hospitalLocation,
      user_latitude: latitude,
      user_longitude: longitude
    };

    // Add user reference for logged-in users, or store requester info for non-logged-in users
    if (user) {
      emergencyRequestData.requested_by_user = user._id;
    } else {
      // Store requester information for non-logged-in emergency requests
      emergencyRequestData.emergency_requester_name = requesterName;
      emergencyRequestData.emergency_requester_email = requesterEmail;
      emergencyRequestData.relation_to_patient = relationToPatient;
      emergencyRequestData.requested_by_user = null; // No user reference
    }

    const emergencyRequest = await BloodRequest.create(emergencyRequestData);

    // After saving the request, attempt to notify nearby donors (if firebase admin initialized)
    try {
      // Default search radius (meters)
      const MAX_DISTANCE_METERS = 20000; // 20 km

      let latitudeNum = parseFloat(latitude);
      let longitudeNum = parseFloat(longitude);

      if (!isNaN(latitudeNum) && !isNaN(longitudeNum)) {
        // Find donors near the provided coordinates who are marked ready and have a token
        const nearbyDonors = await Donor.find({
          is_critical_ready: true,
          fcmToken: { $exists: true, $ne: null },
          current_location: {
            $near: {
              $geometry: { type: 'Point', coordinates: [longitudeNum, latitudeNum] },
              $maxDistance: MAX_DISTANCE_METERS
            }
          }
        }).limit(200);

        const tokens = nearbyDonors.map(d => d.fcmToken).filter(Boolean);
        // Remove duplicate tokens to prevent duplicate notifications for the same device
        const uniqueTokens = Array.from(new Set(tokens));
        if (uniqueTokens.length !== tokens.length) {
          console.log(`🔁 Removed ${tokens.length - uniqueTokens.length} duplicate token(s) before sending`);
        }

        if (uniqueTokens.length > 0 && admin && typeof admin.messaging === 'function') {
          const message = {
            notification: {
              title: '🆘 URGENT BLOOD REQUEST!',
              body: `A hospital nearby needs blood type ${emergencyRequest.blood_type}. Please help if you can.`
            },
            data: {
              requestId: emergencyRequest._id.toString(),
              url: `/emergency/${emergencyRequest._id}`
            },
            tokens: uniqueTokens
          };

          try {
            const response = await admin.messaging().sendMulticast(message);
            console.log(`🚀 Successfully sent notifications: ${response.successCount} successes, ${response.failureCount} failures`);
            if (response.failureCount > 0) {
              // Optionally, log details of failures for pruning invalid tokens
              response.responses.forEach((r, idx) => {
                if (!r.success) {
                  console.warn(`Failed to send to token index ${idx}:`, r.error && r.error.message);
                }
              });
            }
          } catch (err) {
            console.error('❌ Error sending FCM messages:', err);
          }
        } else {
          console.log('ℹ️ No matching donors with tokens found or Firebase admin not initialized.');
        }
      }
    } catch (notifyErr) {
      console.error('Error while notifying donors:', notifyErr);
    }

    return NextResponse.json({
      success: true,
      message: "Emergency blood request submitted successfully",
      requestId: emergencyRequest._id,
      data: emergencyRequest
    });

  } catch (error) {
    console.error("Emergency request error:", error);
    return NextResponse.json(
      { error: "Failed to submit emergency request" },
      { status: 500 }
    );
  }
}
