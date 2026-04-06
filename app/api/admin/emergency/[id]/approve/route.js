import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/authMiddleware";
import connectDB from "@/db/connectDB.mjs";
import BloodRequest from "@/models/BloodRequest.js";
import Donor from "@/models/Doner.js";
import User from "@/models/User.js";
import admin from "@/config/firebase.mjs";
import { getCompatibleBloodTypes } from "@/lib/bloodCompatibility";

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude 1
 * @param {number} lon1 - Longitude 1
 * @param {number} lat2 - Latitude 2
 * @param {number} lon2 - Longitude 2
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function PATCH(req, { params }) {
  try {
    await connectDB();

    // ====== 1. ROLE CHECK: Only bloodbank_admin (not admin) ======
    const token = await getAuthToken(req);
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Please login or provide Bearer token" },
        { status: 401 }
      );
    }
    if (token.role !== 'bloodbank_admin') {
      return NextResponse.json(
        { error: "Unauthorized - Only Blood Bank Admin can approve and broadcast emergency requests" },
        { status: 403 }
      );
    }

    const { id } = params;

    // ====== 2. FETCH EMERGENCY REQUEST ======
    const emergencyRequest = await BloodRequest.findById(id);
    if (!emergencyRequest) {
      return NextResponse.json(
        { error: "Emergency request not found" },
        { status: 404 }
      );
    }

    // Ensure request is pending before approving
    if (emergencyRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Request must be in pending status to approve" },
        { status: 400 }
      );
    }

    // ====== 3. UPDATE STATUS TO ACTIVE FIRST (before FCM) ======
    emergencyRequest.status = "active";
    await emergencyRequest.save();

    console.log(`✅ Emergency request ${id} status updated to ACTIVE`);

    // ====== 4. STRICT FILTERING FOR COMPATIBLE DONORS ======
    let donorsNotified = 0;
    let failedNotifications = 0;

    try {
      const compatibleBloodTypes = getCompatibleBloodTypes(emergencyRequest.blood_type);
      
      if (compatibleBloodTypes.length === 0) {
        console.warn(`⚠️ No compatible blood types found for ${emergencyRequest.blood_type}`);
        return NextResponse.json({
          success: true,
          message: "Emergency request approved but no compatible blood types exist",
          donorsNotified: 0,
          data: emergencyRequest
        });
      }

      // Hospital location (from emergency request)
      const hospitalLat = emergencyRequest.user_latitude || 0;
      const hospitalLon = emergencyRequest.user_longitude || 0;
      const MAX_DISTANCE_KM = 20; // 20km radius

      // CONDITION 1: Get all donor users
      const donorUsers = await User.find({ role: 'user' }).select('_id');
      const donorUserIds = donorUsers.map(u => u._id);

      if (donorUserIds.length === 0) {
        console.warn(`⚠️ No donor users found in system`);
        return NextResponse.json({
          success: true,
          message: "Emergency request approved but no donors registered",
          donorsNotified: 0,
          data: emergencyRequest
        });
      }

      // STRICT FILTERING: All 4 conditions must be satisfied
      const compatibleDonors = await Donor.find({
        // Condition 1: role is 'user' (identifies as donor)
        user_id: { $in: donorUserIds },
        // Condition 2: verification_status is 'VERIFIED' (only verified donors)
        verification_status: 'VERIFIED',
        // Condition 3: is_critical_ready is true
        is_critical_ready: true,
        // Condition 4: Compatible blood type
        blood_type: { $in: compatibleBloodTypes }
      }).populate('user_id', 'fcmToken email name');

      console.log(`📊 Found ${compatibleDonors.length} donors with ALL matching criteria:
        - role: 'user' (has Doner profile)
        - verification_status: 'VERIFIED'
        - is_critical_ready: true
        - blood_type: compatible (${compatibleBloodTypes.join(', ')})`);

      if (compatibleDonors.length === 0) {
        console.warn(`⚠️ No donors meet all criteria`);
        return NextResponse.json({
          success: true,
          message: "Emergency request approved but no donors meet strict criteria",
          donorsNotified: 0,
          data: emergencyRequest
        });
      }

      // CONDITION 5: Filter by distance (20km from hospital)
      const nearbyDonors = compatibleDonors.filter(donor => {
        if (!donor.current_location || !donor.current_location.coordinates) {
          console.warn(`⚠️ Donor ${donor._id} has no location data`);
          return false;
        }

        const [donorLon, donorLat] = donor.current_location.coordinates;
        const distance = calculateDistance(hospitalLat, hospitalLon, donorLat, donorLon);

        return distance <= MAX_DISTANCE_KM;
      });

      console.log(`📍 After distance filter (${MAX_DISTANCE_KM}km): ${nearbyDonors.length} donors remain`);

      if (nearbyDonors.length === 0) {
        console.warn(`⚠️ No nearby donors found within ${MAX_DISTANCE_KM}km`);
        return NextResponse.json({
          success: true,
          message: "Emergency request approved but no donors within 20km",
          donorsNotified: 0,
          totalCompatibleDonors: compatibleDonors.length,
          data: emergencyRequest
        });
      }

      // ====== 5. SEND FCM NOTIFICATIONS (after status is active) ======
      for (const donor of nearbyDonors) {
        try {
          // Get FCM token from donor profile first, then fallback to user profile
          let fcmToken = donor.fcmToken;
          
          if (!fcmToken && donor.user_id) {
            fcmToken = donor.user_id.fcmToken;
          }

          if (!fcmToken) {
            console.warn(`⚠️ Donor ${donor._id} (${donor.user_id?.email}) has no FCM token`);
            failedNotifications++;
            continue;
          }

          // Calculate distance for notification detail
          const [donorLon, donorLat] = donor.current_location.coordinates;
          const distanceKm = calculateDistance(hospitalLat, hospitalLon, donorLat, donorLon);

          const fcmMessage = {
            notification: {
              title: '🩸 URGENT: Blood Request',
              body: `Blood type ${emergencyRequest.blood_type} (${emergencyRequest.units_required} units) urgently needed - ${distanceKm.toFixed(1)}km away`
            },
            data: {
              requestId: emergencyRequest._id.toString(),
              bloodType: emergencyRequest.blood_type,
              unitsRequired: emergencyRequest.units_required.toString(),
              hospitalLocation: emergencyRequest.hospital_location || 'Hospital',
              emergencyDetails: emergencyRequest.emergency_details || 'Emergency blood request',
              distanceKm: distanceKm.toFixed(1)
            },
            token: fcmToken
          };

          const fcmResponse = await admin.messaging().send(fcmMessage);
          console.log(`✅ FCM sent to donor ${donor._id} (${donor.user_id?.email}): ${fcmResponse}`);
          donorsNotified++;

        } catch (fcmError) {
          console.error(`❌ Failed to send FCM to donor ${donor._id}:`, fcmError.message);
          failedNotifications++;
        }
      }

      console.log(`📢 Emergency broadcasting complete: ${donorsNotified} donors notified, ${failedNotifications} failed`);

      // ====== 6. RETURN RESPONSE WITH BROADCAST STATISTICS ======
      return NextResponse.json({
        success: true,
        message: "Emergency request approved and donor notifications sent",
        donorsNotified: donorsNotified,
        totalCompatibleDonors: compatibleDonors.length,
        totalNearbyDonors: nearbyDonors.length,
        failedNotifications: failedNotifications,
        broadcastDetails: {
          requestedBloodType: emergencyRequest.blood_type,
          compatibleBloodTypes: compatibleBloodTypes,
          searchRadius: `${MAX_DISTANCE_KM}km`,
          successRate: nearbyDonors.length > 0 ? `${Math.round((donorsNotified / nearbyDonors.length) * 100)}%` : '0%'
        },
        data: emergencyRequest
      });

    } catch (filterError) {
      console.error("Donor filtering or notification error:", filterError);
      // Request is already approved and status is active, so return success
      return NextResponse.json({
        success: true,
        message: "Emergency request approved. Donor notification encountered an error.",
        donorsNotified: donorsNotified,
        failedNotifications: failedNotifications,
        error: filterError.message,
        data: emergencyRequest
      }, { status: 200 });
    }

  } catch (error) {
    console.error("Admin approve emergency request error:", error);
    return NextResponse.json(
      { error: "Failed to approve emergency request", details: error.message },
      { status: 500 }
    );
  }
}