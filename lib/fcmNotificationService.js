import admin from 'firebase-admin';
import Doner from '@/models/Doner.js';
import User from '@/models/User.js';
import DonorContactRequest from '@/models/DonorContactRequest.js';
import mongoose from 'mongoose';
import { createExpiryDate } from './dateUtils.js';

/**
 * Send FCM notification to a specific FCM token (donor/mobile app)
 * @param {string} fcmToken - FCM token from mobile device
 * @param {object} notification - Notification object { title, body }
 * @param {object} data - Additional data to send with notification
 */
async function sendFCMByToken(fcmToken, notification, data = {}) {
  try {
    if (!fcmToken) {
      console.warn(`[FCM] No FCM token provided`);
      return false;
    }

    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: {
        ...data,
        timestamp: new Date().toISOString()
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK'
        }
      },
      apns: {
        headers: {
          'apns-priority': '10'
        }
      },
      webpush: {
        data: {
          ...data,
          timestamp: new Date().toISOString()
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log(`[FCM] ✅ Sent notification to token:`, response);
    return true;
  } catch (error) {
    console.error(`[FCM] Error sending to token:`, error.message);
    return false;
  }
}

/**
 * Send FCM notification to a specific user
 * @param {string} userId - User ID
 * @param {object} notification - Notification object { title, body }
 * @param {object} data - Additional data to send with notification
 */
async function sendFCMToUser(userId, notification, data = {}) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.fcmToken) {
      console.warn(`[FCM] User ${userId} has no FCM token`);
      return false;
    }

    const message = {
      token: user.fcmToken,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: {
        ...data,
        timestamp: new Date().toISOString()
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK'
        }
      },
      apns: {
        headers: {
          'apns-priority': '10'
        }
      },
      webpush: {
        data: {
          ...data,
          timestamp: new Date().toISOString()
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log(`[FCM] Successfully sent notification to ${userId}:`, response);
    return true;
  } catch (error) {
    console.error(`[FCM] Error sending notification to user ${userId}:`, error);
    return false;
  }
}

/**
 * Send FCM to multiple users in parallel
 * @param {array} userIds - Array of User IDs
 * @param {object} notification - Notification object { title, body }
 * @param {object} data - Additional data
 */
async function sendFCMToMultipleUsers(userIds, notification, data = {}) {
  try {
    const failedUserIds = [];
    
    const promises = userIds.map(userId => 
      sendFCMToUser(userId, notification, data)
        .then(success => {
          if (!success) {
            failedUserIds.push(userId);
          }
          return success;
        })
        .catch(err => {
          console.error(`[FCM Batch] Error with user ${userId}:`, err);
          failedUserIds.push(userId);
          return false;
        })
    );

    const results = await Promise.allSettled(promises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    const failureCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === false)).length;
    
    console.log(`[FCM Batch] Sent notifications to ${successCount}/${userIds.length} users (${failureCount} failed)`);
    
    // ✅ FIX: Return structured object with detailed failure info
    return {
      successCount,
      failureCount,
      totalAttempted: userIds.length,
      failed_users: failedUserIds,
      success_rate: successCount / userIds.length
    };
  } catch (error) {
    console.error('[FCM Batch] Error sending batch notifications:', error);
    return {
      successCount: 0,
      failureCount: userIds.length,
      totalAttempted: userIds.length,
      failed_users: userIds,
      success_rate: 0,
      error: error.message
    };
  }
}

/**
 * Find nearby donors with specific blood type and send SOS notification
 * @param {object} hospitalRequest - HospitalRequest object with blood type, units, etc.
 * @param {object} targetBloodBankLocation - Target blood bank location { longitude, latitude, address }
 * @param {string} bloodbankName - Name of the target blood bank
 * @param {number} radiusKm - Search radius in kilometers (default 10km)
 * @returns {Promise<Object>} - Result object with metrics {totalDonorsFound, donorsNotified, recordsCreated, failuresCount}
 */
async function broadcastSOSToNearbyDonors(hospitalRequest, targetBloodBankLocation, bloodbankName, radiusKm = 10) {
  try {
    // ✅ FIX: Always return consistent object structure
    if (!targetBloodBankLocation || !targetBloodBankLocation.longitude || !targetBloodBankLocation.latitude) {
      console.error('[SOS] Invalid blood bank location:', targetBloodBankLocation);
      return {
        totalDonorsFound: 0,
        donorsNotified: 0,
        recordsCreated: 0,
        failuresCount: 0,
        geocodeFailed: true,
        error: 'Invalid blood bank location'
      };
    }

    const radiusMeters = radiusKm * 1000;
    
    console.log(`[SOS] 🔍 Searching for donors near blood bank: ${bloodbankName}`);
    console.log(`[SOS] Target location: [${targetBloodBankLocation.longitude}, ${targetBloodBankLocation.latitude}], Radius: ${radiusKm}km`);
    
    // Find nearby donors with same blood type - NEAR THE TARGET BLOOD BANK
    const nearbyDonors = await Doner.find({
      blood_type: hospitalRequest.blood_type,
      is_active: true,
      current_location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [targetBloodBankLocation.longitude, targetBloodBankLocation.latitude]
          },
          $maxDistance: radiusMeters
        }
      }
    }).populate('user_id', 'name email fcmToken').limit(50); // Limit to 50 nearest donors

    if (nearbyDonors.length === 0) {
      console.log('[SOS] No nearby donors found');
      return {
        totalDonorsFound: 0,
        donorsNotified: 0,
        database_records_created: 0,
        failuresCount: 0,
        geocodeFailed: 0
      };
    }

    console.log(`[SOS] ✅ Found ${nearbyDonors.length} donors near blood bank`);

    // ✅ FIX: Include donors with EITHER mobile FCM token OR web app FCM token
    // Don't reject donors just because they lack mobile token - try web token as fallback
    const validDonors = nearbyDonors.filter(donor => 
      donor.user_id &&  // Must have user profile linked
      (donor.fcmToken || donor.user_id?.fcmToken)  // Must have at least ONE FCM token
    );

    console.log(`[SOS] 📍 Donors with FCM tokens: ${validDonors.length} (mobile: ${nearbyDonors.filter(d => d.fcmToken).length}, web: ${nearbyDonors.filter(d => d.user_id?.fcmToken && !d.fcmToken).length})`);

    if (validDonors.length === 0) {
      console.log('[SOS] ⚠️  No donors with any FCM tokens found');
      console.log(`[SOS] DEBUG: Found ${nearbyDonors.length} donors but none have FCM tokens`);
      // Even without FCM, create DB records for tracking
      let dbRecordsCreated = 0;
      for (let donor of nearbyDonors) {
        try {
          await DonorContactRequest.create({
            requestId: new mongoose.Types.ObjectId(hospitalRequest._id),
            donorId: new mongoose.Types.ObjectId(donor._id),
            requesterId: new mongoose.Types.ObjectId(hospitalRequest.hospital_id),
            bloodBankId: new mongoose.Types.ObjectId(hospitalRequest.bloodbank_id),
            hospitalId: new mongoose.Types.ObjectId(hospitalRequest.hospital_id),
            requestType: 'EMERGENCY',
            sourceType: 'emergency_broadcast',
            bloodType: hospitalRequest.blood_type,
            quantity: hospitalRequest.units_requested || 1,
            urgencyLevel: (hospitalRequest.urgency_level || 'medium').charAt(0).toUpperCase() + (hospitalRequest.urgency_level || 'medium').slice(1),
            status: 'pending',
            message: `Emergency blood request: ${hospitalRequest.blood_type} type needed urgently`,
            broadcast_notification_sent: false,
            createdAt: new Date(),
            expiresAt: createExpiryDate(24)  // ✅ FIX: Use timezone-safe date utility
          });
          dbRecordsCreated++;
        } catch (err) {
          console.error(`[SOS] Error creating DB record for donor ${donor._id}:`, err.message);
        }
      }
      return {
        totalDonorsFound: nearbyDonors.length,
        donorsNotified: 0,
        database_records_created: dbRecordsCreated,
        failuresCount: nearbyDonors.length - dbRecordsCreated,
        geocodeFailed: 0
      };
    }

    // Prepare SOS notification with blood bank address
    const notificationTitle = `🆘 URGENT - Need Blood Donation Now`;
    const bloodbankAddress = targetBloodBankLocation?.address || 'your nearest blood bank';
    const notificationBody = `🚨 URGENT: ${bloodbankName} needs ${hospitalRequest.blood_type} blood. Visit: ${bloodbankAddress}`;

    const notificationData = {
      type: 'SOS_DONOR_BROADCAST',
      requestId: hospitalRequest._id.toString(),
      hospitalId: hospitalRequest.hospital_id.toString(),
      bloodType: hospitalRequest.blood_type,
      bloodbankName: bloodbankName,
      bloodbankLocation: JSON.stringify(targetBloodBankLocation),
      unitsNeeded: hospitalRequest.units_requested.toString(),
      urgencyLevel: hospitalRequest.urgency_level,
      patientCondition: hospitalRequest.patient_details?.condition || 'Critical',
      isEmergency: hospitalRequest.is_emergency ? 'true' : 'false'
    };

    // Send notifications in parallel and create DonorContactRequest records
    console.log(`[SOS] Sending SOS notifications to ${validDonors.length} donors...`);
    
    let successCount = 0;
    let dbRecordsCreated = 0;
    let failures = [];

    // Process each valid donor: send FCM and save to database
    // ✅ FIX: Use donor.fcmToken (mobile app) primarily
    for (let donor of validDonors) {
      try {
        // Create DonorContactRequest record in database FIRST
        // This ensures DB tracking even if FCM fails
        let donorContactRequest = null;
        try {
          donorContactRequest = await DonorContactRequest.create({
            requestId: new mongoose.Types.ObjectId(hospitalRequest._id),
            donorId: new mongoose.Types.ObjectId(donor._id),
            requesterId: new mongoose.Types.ObjectId(hospitalRequest.hospital_id),
            bloodBankId: new mongoose.Types.ObjectId(hospitalRequest.bloodbank_id),
            hospitalId: new mongoose.Types.ObjectId(hospitalRequest.hospital_id),
            requestType: 'EMERGENCY',
            sourceType: 'emergency_broadcast',
            bloodType: hospitalRequest.blood_type,
            quantity: hospitalRequest.units_requested || 1,
            urgencyLevel: (hospitalRequest.urgency_level || 'medium').charAt(0).toUpperCase() + (hospitalRequest.urgency_level || 'medium').slice(1),
            status: 'pending',
            message: `Emergency blood request: ${hospitalRequest.blood_type} type needed urgently`,
            broadcast_notification_sent: false,
            createdAt: new Date(),
            expiresAt: createExpiryDate(24)  // ✅ FIX: Use timezone-safe date utility
          });
          dbRecordsCreated++;
          console.log(`[SOS] ✅ Created DonorContactRequest for donor ${donor._id}`);
        } catch (dbError) {
          console.error(`[SOS] ⚠️  Error creating DonorContactRequest for donor ${donor._id}:`, dbError.message);
          failures.push({ donorId: donor._id, error: dbError.message, step: 'DB' });
        }

        // ✅ FIX: Send FCM to donor mobile app (donor.fcmToken) - PRIMARY
        let fcmSuccess = false;
        try {
          if (donor.fcmToken) {
            console.log(`[SOS] 📱 Sending FCM to donor ${donor._id} via mobile token`);
            fcmSuccess = await sendFCMByToken(
              donor.fcmToken,
              { title: notificationTitle, body: notificationBody },
              notificationData
            );

            if (fcmSuccess) {
              successCount++;
              console.log(`[SOS] ✅ FCM sent to donor ${donor._id} mobile app`);
              
              // Update DB record to mark FCM as sent
              if (donorContactRequest) {
                await DonorContactRequest.updateOne(
                  { _id: donorContactRequest._id },
                  { broadcast_notification_sent: true }
                );
              }
            } else {
              console.warn(`[SOS] ⚠️  FCM to mobile token failed for donor ${donor._id}`);
              failures.push({ donorId: donor._id, error: 'Mobile FCM failed', step: 'FCM_MOBILE' });
            }
          } else {
            console.warn(`[SOS] ⚠️  Donor ${donor._id} has no fcmToken`);
          }
        } catch (fcmError) {
          console.error(`[SOS] ⚠️  FCM error for donor ${donor._id}:`, fcmError.message);
          failures.push({ donorId: donor._id, error: fcmError.message, step: 'FCM' });
        }

        // ✅ FALLBACK: Try web app token if mobile fails
        if (!fcmSuccess && donor.user_id?.fcmToken) {
          try {
            console.log(`[SOS] 🌐 Fallback: Sending FCM to user ${donor.user_id._id} via web token`);
            const webFcmSuccess = await sendFCMToUser(
              donor.user_id._id,
              { title: notificationTitle, body: notificationBody },
              notificationData
            );

            if (webFcmSuccess) {
              successCount++;
              console.log(`[SOS] ✅ FCM sent to donor ${donor._id} web app`);
              
              if (donorContactRequest) {
                await DonorContactRequest.updateOne(
                  { _id: donorContactRequest._id },
                  { broadcast_notification_sent: true }
                );
              }
            }
          } catch (webFcmError) {
            console.error(`[SOS] ⚠️  Web FCM error for donor ${donor._id}:`, webFcmError.message);
          }
        }
      } catch (donorError) {
        console.error(`[SOS] ❌ Error processing donor ${donor._id}:`, donorError.message);
        failures.push({ donorId: donor._id, error: donorError.message, step: 'PROCESSING' });
      }
    }

    console.log(`[SOS] ✅ Summary: ${successCount} FCM sent, ${dbRecordsCreated} DB records created`);
    if (failures.length > 0) {
      console.warn(`[SOS] ⚠️  ${failures.length} failures encountered (see details above)`);
    }
    
    // ✅ FIX: Return OBJECT with all metrics (NOT just number)
    return {
      totalDonorsFound: nearbyDonors.length,
      donorsNotified: successCount,      // FCM notifications successfully sent
      database_records_created: dbRecordsCreated,  // DonorContactRequest records created
      failuresCount: failures.length,
      geocodeFailed: 0
    };
  } catch (error) {
    console.error('[SOS] Error broadcasting to donors:', error);
    return {
      totalDonorsFound: 0,
      donorsNotified: 0,
      recordsCreated: 0,
      failuresCount: 0,
      geocodeFailed: false,
      error: error.message
    };
  }
}

/**
 * Find nearest alternative blood banks using geospatial queries
 * @param {object} hospitalLocation - Hospital location { latitude, longitude, address }
 * @param {array} excludeBloodBankIds - Blood bank IDs to exclude (already rejected)
 * @param {string} bloodType - Blood type needed (optional, for validation)
 * @param {number} radiusKm - Search radius in kilometers (default 50km)
 * @returns {Promise<array>} - Array of nearest blood bank User objects with location
 */
async function findNearestBloodBanks(hospitalLocation, excludeBloodBankIds = [], bloodType = null, radiusKm = 50) {
  try {
    if (!hospitalLocation || typeof hospitalLocation.longitude !== 'number' || typeof hospitalLocation.latitude !== 'number') {
      console.error('[Auto-Routing] Invalid hospital location:', hospitalLocation);
      console.warn('[Auto-Routing] Expected: {longitude: number, latitude: number, address?: string}');
      return [];
    }

    const radiusMeters = radiusKm * 1000;

    console.log(`[Auto-Routing] 🔍 Searching for blood banks near hospital...`);
    console.log(`[Auto-Routing] Location: [${hospitalLocation.longitude.toFixed(4)}, ${hospitalLocation.latitude.toFixed(4)}], Radius: ${radiusKm}km`);
    console.log(`[Auto-Routing] Excluding ${excludeBloodBankIds.length} already-rejected banks`);

    // Query blood banks with valid location using geospatial $near
    const nearestBloodBanks = await User.find({
      role: 'bloodbank_admin',
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [hospitalLocation.longitude, hospitalLocation.latitude]
          },
          $maxDistance: radiusMeters
        }
      },
      _id: { $nin: excludeBloodBankIds }
    })
    .select('_id name email phone location')
    .limit(5)
    .lean();

    console.log(`[Auto-Routing] ✅ Query returned ${nearestBloodBanks.length} blood banks within ${radiusKm}km`);
    
    if (nearestBloodBanks.length === 0) {
      console.warn('[Auto-Routing] ⚠️  No blood banks found. Options:');
      console.warn('[Auto-Routing]   - Check if blood banks have location data set');
      console.warn('[Auto-Routing]   - Check if location/2dsphere index exists on User model');
      console.warn('[Auto-Routing]   - Fallback: will broadcast SOS directly to donors');
      return [];
    }

    // Filter banks with valid location
    const validBanks = nearestBloodBanks.filter(bank => 
      bank.location && 
      bank.location.coordinates && 
      bank.location.coordinates.length === 2
    );

    console.log(`[Auto-Routing] ✓ ${validBanks.length} banks have valid location data`);
    return validBanks;
  } catch (error) {
    console.error('[Auto-Routing] Error finding blood banks:', error);
    return [];
  }
}

/**
 * Send notification to blood bank admin via Pusher
 * @param {string} bloodbankId - Blood bank admin ID
 * @param {object} request - Hospital request object
 * @param {object} hospital - Hospital object
 */
async function notifyBloodBankViaPusher(bloodbankId, request, hospital, pusher) {
  try {
    const bloodbankChannel = `bloodbank-${bloodbankId}`;
    
    await pusher.trigger(bloodbankChannel, 'auto-request-forward', {
      message: `🚑 Blood request${request.is_emergency ? ' (EMERGENCY)' : ''} ${request.blood_type} from hospital ${hospital.name}`,
      requestId: request._id,
      hospitalId: request.hospital_id,
      hospitalName: hospital.name,
      bloodType: request.blood_type,
      units: request.units_requested,
      urgency: request.urgency_level,
      isEmergency: request.is_emergency,
      patientInfo: request.patient_details,
      reason: request.reason,
      forwardedAt: new Date().toISOString()
    });

    console.log(`[Pusher] Forwarded request to blood bank ${bloodbankId}`);
    return true;
  } catch (error) {
    console.error(`[Pusher] Error notifying blood bank ${bloodbankId}:`, error);
    return false;
  }
}

export {
  sendFCMToUser,
  sendFCMToMultipleUsers,
  broadcastSOSToNearbyDonors,
  findNearestBloodBanks,
  notifyBloodBankViaPusher
};
