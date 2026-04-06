import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/authMiddleware";
import connectDB from "@/db/connectDB.mjs";
import BloodRequest from "@/models/BloodRequest.js";
import DonorContactRequest from "@/models/DonorContactRequest.js";
import Donor from "@/models/Doner.js";
import User from "@/models/User.js";
import admin from "@/config/firebase.mjs";

/**
 * PATCH /api/admin/emergency/[id]/reject
 * Blood Bank Admin rejects an emergency blood request
 * 
 * Automatically creates DonorContactRequest entries for nearby donors
 * Sends FCM notifications to nearby donors
 * 
 * Body: { rejection_reason: "string" }
 */
export async function PATCH(req, { params }) {
  try {
    await connectDB();

    // ====== 1. ROLE CHECK: Only bloodbank_admin ======
    const token = await getAuthToken(req);
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Please login or provide Bearer token" },
        { status: 401 }
      );
    }
    if (token.role !== 'bloodbank_admin') {
      return NextResponse.json(
        { error: "Unauthorized - Only Blood Bank Admin can reject emergency requests" },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await req.json();
    const { rejection_reason } = body;

    if (!rejection_reason) {
      return NextResponse.json(
        { error: "rejection_reason is required" },
        { status: 400 }
      );
    }

    // ====== 2. FETCH EMERGENCY REQUEST ======
    const emergencyRequest = await BloodRequest.findById(id)
      .populate('requested_by_hospital', 'name email');

    if (!emergencyRequest) {
      return NextResponse.json(
        { error: "Emergency request not found" },
        { status: 404 }
      );
    }

    // Get blood bank admin info
    const bloodBankAdmin = await User.findById(token.userId).select('_id name email');
    if (!bloodBankAdmin) {
      return NextResponse.json(
        { error: "Blood bank admin not found" },
        { status: 404 }
      );
    }

    // Get hospital name
    const hospital = emergencyRequest.requested_by_hospital;
    const hospitalName = hospital?.name || 'Unknown Hospital';
    const hospitalId = hospital?._id || null;

    console.log(`🏥 Hospital: ${hospitalName} (ID: ${hospitalId})`);
    console.log(`🏥 Blood Bank Rejecting: ${bloodBankAdmin.name} (ID: ${bloodBankAdmin._id})`);
    if (!["pending", "active"].includes(emergencyRequest.status)) {
      return NextResponse.json(
        { error: `Cannot reject request with status: ${emergencyRequest.status}` },
        { status: 400 }
      );
    }

    // ====== 3. UPDATE REQUEST STATUS TO REJECTED ======
    emergencyRequest.status = "REJECTED";
    emergencyRequest.rejection_reason = rejection_reason;
    emergencyRequest.fulfilled_date = new Date();
    await emergencyRequest.save();

    console.log(`🚫 Emergency request ${id} REJECTED by blood bank admin ${token.userId}`);
    console.log(`   Rejection reason: ${rejection_reason}`);

    // ====== 4. AUTO-CREATE DonorContactRequest FOR NEARBY DONORS ======
    try {
      // Get hospital location from emergency request
      const hospitalLat = emergencyRequest.user_latitude || 0;
      const hospitalLon = emergencyRequest.user_longitude || 0;
      const MAX_DISTANCE_KM = 20;

      console.log(`📍 Creating donor contact requests for nearby donors (${MAX_DISTANCE_KM}km radius)`);

      // Find all verified, ready donors with compatible blood types
      const donorUsers = await User.find({ role: 'user' }).select('_id');
      const donorUserIds = donorUsers.map(u => u._id);

      if (donorUserIds.length === 0) {
        console.warn(`⚠️ No donor users found to notify`);
      }

      // Get compatible blood types
      const compatibleBloodTypes = getCompatibleBloodTypes(emergencyRequest.blood_type);

      // Find nearby donors with matching blood type
      // Note: Removed is_critical_ready filter - in EMERGENCY, ALL verified donors should be contacted
      
      // Build query filter
      const donorQuery = {
        user_id: { $in: donorUserIds },
        verification_status: 'VERIFIED',
        blood_type: { $in: compatibleBloodTypes }
      };

      // Only add geospatial filter if hospital location is valid (not default 0,0)
      if (hospitalLat !== 0 || hospitalLon !== 0) {
        donorQuery.current_location = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [hospitalLon, hospitalLat]
            },
            $maxDistance: MAX_DISTANCE_KM * 1000 // Convert km to meters
          }
        };
      }

      const nearbyDonors = await Donor.find(donorQuery).populate('user_id', 'fcmToken email name');

      console.log(`📊 Found ${nearbyDonors.length} nearby donors for auto-notification`);
      console.log(`   - Searched location: (${hospitalLat}, ${hospitalLon}), radius: ${MAX_DISTANCE_KM}km`);
      console.log(`   - Compatible blood types: ${compatibleBloodTypes.join(', ')}`);

      // ====== 5. CREATE DonorContactRequest FOR EACH NEARBY DONOR ======
      const createdRequests = [];
      const fcmTokens = [];

      console.log(`\n🔔 Starting DonorContactRequest creation for ${nearbyDonors.length} donors...`);

      for (const donor of nearbyDonors) {
        try {
          // Validate donor has required fields
          if (!donor._id) {
            console.error(`❌ Donor missing _id:`, JSON.stringify(donor));
            continue;
          }

          console.log(`   Creating EMERGENCY request for: ${donor._id} (user: ${donor.user_id?.name})`);
          
          // Create DonorContactRequest with type 'EMERGENCY'
          // ✅ FIX: Ensure all required fields are populated
          const donorContactRequest = await DonorContactRequest.create({
            requesterId: hospitalId, // Hospital as requester
            donorId: donor._id, // ✅ FIX: Use donor._id from query result
            hospitalId: hospitalId, // ✅ NEW: Track which hospital made the request
            bloodbankId: bloodBankAdmin._id, // ✅ FIX: Blood bank that rejected
            bloodType: emergencyRequest.blood_type,
            urgencyLevel: 'Critical',
            message: `🚨 EMERGENCY: ${requestDetails(emergencyRequest)}. 🏥 ${hospitalName} needs urgent blood supply. ❌ Primary blood bank rejected. Can you help?`,
            status: 'pending',
            requestDate: new Date(),
            expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours expiry
            // Mark as emergency request
            requestType: 'EMERGENCY',
            sourceType: 'emergency_broadcast'
          });

          if (!donorContactRequest._id) {
            console.error(`❌ Failed to create DonorContactRequest - returned null ID`);
            continue;
          }

          createdRequests.push({
            _id: donorContactRequest._id,
            donorId: donor._id,
            hospitalId: hospitalId,
            bloodbankId: bloodBankAdmin._id
          });

          console.log(`   ✅ Created: ${donorContactRequest._id}`);
          console.log(`      └─ donorId: ${donorContactRequest.donorId} (✓)`);
          console.log(`      └─ hospitalId: ${donorContactRequest.hospitalId} (✓)`);
          console.log(`      └─ bloodbankId: ${donorContactRequest.bloodbankId} (✓)`);

          // Collect FCM tokens for batch notification
          if (donor.user_id?.fcmToken) {
            fcmTokens.push({
              token: donor.user_id.fcmToken,
              donorName: donor.user_id.name
            });
          }
        } catch (error) {
          console.error(`❌ Error creating DonorContactRequest for donor ${donor._id}:`, error.message);
          console.error(`   Error details:`, error);
        }
      }
      
      console.log(`✅ Successfully created ${createdRequests.length}/${nearbyDonors.length} EMERGENCY requests\n`);

      // ====== 6. SEND FCM NOTIFICATIONS ======
      let notificationsSent = 0;
      let notificationsFailed = 0;

      for (const { token, donorName } of fcmTokens) {
        try {
          const message = {
            notification: {
              title: '🚨 Emergency Blood Request - Backup Option Available',
              body: `Critical: ${emergencyRequest.blood_type} blood needed urgently`,
            },
            data: {
              requestId: id,
              bloodType: emergencyRequest.blood_type,
              type: 'EMERGENCY',
              urgency: 'CRITICAL'
            },
            token: token,
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                  badge: '1'
                }
              }
            },
            android: {
              priority: 'high'
            }
          };

          const response = await admin.messaging().send(message);
          notificationsSent++;
          console.log(`✅ FCM sent to ${donorName}: ${response}`);
        } catch (error) {
          notificationsFailed++;
          console.error(`❌ FCM failed for ${donorName}:`, error.message);
        }
      }

      console.log(`📤 Notifications sent: ${notificationsSent}/${fcmTokens.length}`);

      return NextResponse.json({
        success: true,
        message: 'Emergency request rejected and donor notifications sent',
        rejectionReason: rejection_reason,
        hospitalName: hospitalName,
        hospitalId: hospitalId,
        bloodbankId: bloodBankAdmin._id,
        nearbyDonorsNotified: nearbyDonors.length,
        donorContactRequestsCreated: createdRequests.length,
        createdRequests: createdRequests, // Return details for verification
        notificationsSent,
        notificationsFailed,
        requestId: id
      });

    } catch (notificationError) {
      console.error('Error in donor notification flow:', notificationError);
      
      // Still return success since rejection was saved, but note notification failure
      return NextResponse.json({
        success: true,
        message: 'Emergency request rejected but donor notifications had issues',
        rejectionReason: rejection_reason,
        warning: notificationError.message,
        requestId: id
      }, { status: 200 });
    }

  } catch (error) {
    console.error('❌ Error rejecting emergency request:', error);
    return NextResponse.json(
      { 
        error: 'Failed to reject emergency request',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * Helper function to get compatible blood types based on recipient blood type
 */
function getCompatibleBloodTypes(bloodType) {
  const compatibilityMap = {
    'A+': ['A+', 'A-', 'O+', 'O-'],
    'A-': ['A-', 'O-'],
    'B+': ['B+', 'B-', 'O+', 'O-'],
    'B-': ['B-', 'O-'],
    'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    'AB-': ['A-', 'B-', 'AB-', 'O-'],
    'O+': ['O+', 'O-'],
    'O-': ['O-']
  };

  return compatibilityMap[bloodType] || [bloodType];
}

/**
 * Helper function to format request details for message
 */
function requestDetails(req) {
  const units = req.units_required || '?';
  const type = req.blood_type || 'unknown';
  return `${units} units of ${type} blood`;
}
