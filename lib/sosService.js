import axios from 'axios';
import mongoose from 'mongoose';
import Doner from '@/models/Doner.js';
import DonorContactRequest from '@/models/DonorContactRequest.js';
import admin from 'firebase-admin';
import { createExpiryDate } from './dateUtils.js';

/**
 * 🔍 GEOCODING: Convert hospital address/location string to coordinates using Nominatim
 * Fallback: If lat/lng exist, returns them directly
 * @param {object} locationData - { address: string, latitude?: number, longitude?: number }
 * @returns {Promise<object>} - { latitude, longitude, address, source }
 */
export async function geocodeLocation(locationData) {
  try {
    console.log(`[GEOCODING] Input location data:`, JSON.stringify(locationData));

    // If coordinates already available, return them
    if (locationData.latitude && locationData.longitude) {
      console.log(
        `[GEOCODING] ✅ Using existing coordinates: [${locationData.longitude}, ${locationData.latitude}]`
      );
      return {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        address: locationData.address || 'User Location',
        source: 'direct'
      };
    }

    // If no address, cannot geocode
    if (!locationData.address || locationData.address.trim() === '') {
      console.error(`[GEOCODING] ❌ No address provided and coordinates unavailable`);
      throw new Error('No location data available for geocoding');
    }

    // 🌍 Use Nominatim (OpenStreetMap) for reverse/forward geocoding
    console.log(`[GEOCODING] 🌍 Fetching coordinates from Nominatim for address: ${locationData.address}`);

    const nominatimUrl = 'https://nominatim.openstreetmap.org/search';
    const response = await axios.get(nominatimUrl, {
      params: {
        q: locationData.address,
        format: 'json',
        limit: 1,
        timeout: 10 // seconds
      },
      timeout: 15000, // axios timeout in ms
      headers: {
        'User-Agent': 'RareBlood-Connect/1.0' // Required by Nominatim API
      }
    });

    if (!response.data || response.data.length === 0) {
      console.error(`[GEOCODING] ❌ Nominatim returned no results for: ${locationData.address}`);
      throw new Error(`Could not geocode address: ${locationData.address}`);
    }

    const result = response.data[0];
    const latitude = parseFloat(result.lat);
    const longitude = parseFloat(result.lon);

    console.log(
      `[GEOCODING] ✅ Successfully geocoded: [${longitude}, ${latitude}] from "${locationData.address}"`
    );

    return {
      latitude,
      longitude,
      address: locationData.address,
      source: 'nominatim'
    };
  } catch (error) {
    console.error(`[GEOCODING] ❌ Error geocoding location:`, error.message);
    throw error; // Let caller handle the error
  }
}

/**
 * 🔎 GEOSEARCH: Find donors near a location with matching blood type
 * @param {number} longitude - Longitude coordinate
 * @param {number} latitude - Latitude coordinate
 * @param {string} bloodType - Blood type to match (e.g., 'O+', 'A-', etc.)
 * @param {number} radiusKm - Search radius in kilometers
 * @param {number} maxDonors - Maximum donors to return (limit)
 * @returns {Promise<array>} - Array of matching donors with populated user data
 */
export async function findNearbyDonors(longitude, latitude, bloodType, radiusKm = 10, maxDonors = 50) {
  try {
    console.log(
      `[GEOSEARCH] 🔍 Searching for donors: blood_type=${bloodType}, location=[${longitude}, ${latitude}], radius=${radiusKm}km`
    );

    // Validate coordinates
    if (typeof longitude !== 'number' || typeof latitude !== 'number') {
      throw new Error('Invalid coordinates: longitude and latitude must be numbers');
    }

    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      throw new Error('Invalid coordinates: out of bounds');
    }

    const radiusMeters = radiusKm * 1000;

    // 🔴 CRITICAL: Geospatial query with blood type match + active status
    const nearbyDonors = await Doner.find({
      blood_type: bloodType,
      is_active: true,
      status: { $in: ['active', 'critical_ready'] },
      current_location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude] // [lng, lat] in GeoJSON
          },
          $maxDistance: radiusMeters
        }
      }
    })
      .populate('user_id', 'name email fcmToken phone')
      .limit(maxDonors)
      .lean(); // Use lean() for better performance

    console.log(`[GEOSEARCH] ✅ Found ${nearbyDonors.length} donors within ${radiusKm}km`);

    return nearbyDonors;
  } catch (error) {
    console.error(`[GEOSEARCH] ❌ Error searching for nearby donors:`, error.message);
    throw error;
  }
}

/**
 * 📬 SEND FCM: Send FCM notification to a specific donor
 * @param {object} donor - Donor object with user_id populated
 * @param {object} notification - { title, body }
 * @param {object} data - Additional notification data
 * @returns {Promise<boolean>} - Success/failure
 */
async function sendFCMToDonor(donor, notification, data) {
  try {
    // ✅ FIX: Use donor.fcmToken (mobile app) - PRIMARY
    let fcmToken = donor.fcmToken;
    
    // ✅ FALLBACK: Use user.fcmToken (web app) if donor doesn't have mobile token
    if (!fcmToken && donor.user_id?.fcmToken) {
      console.warn(`[FCM] ⚠️ Donor ${donor._id} using web app token (fallback)`);
      fcmToken = donor.user_id.fcmToken;
    }

    if (!fcmToken) {
      console.warn(`[FCM] ⚠️ Donor ${donor._id} has no FCM token (mobile or web)`);
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
      }
    };

    const response = await admin.messaging().send(message);
    console.log(`[FCM] ✅ Sent to donor ${donor._id}:`, response);
    return true;
  } catch (error) {
    console.error(`[FCM] ❌ Error sending to donor ${donor._id}:`, error.message);
    return false;
  }
}

/**
 * 🔴 BROADCAST SOS: Notify nearby donors and create contact requests
 * Called when blood bank rejects emergency request
 *
 * @param {object} hospitalRequest - HospitalRequest document with:
 *   - _id: request ID
 *   - hospital_id: hospital user ID
 *   - blood_type: blood type needed
 *   - units_requested: units needed
 *   - urgency_level: urgency level
 *   - is_emergency: boolean
 *   - search_radius: search radius in km
 *   - hospital_location: { latitude, longitude, address } OR null
 * @param {object} options - { bloodBankName: string, bloodBankLocation: object }
 * @returns {Promise<object>} - { donorsNotified: number, recordsCreated: number, geocodeFailed: boolean }
 */
export async function broadcastSOSToNearbyDonors(hospitalRequest, options = {}) {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🔴 BROADCAST SOS: Starting emergency donor broadcast');
    console.log('='.repeat(70));

    const { bloodBankName = 'Emergency', bloodBankLocation = null } = options;

    // 🔧 STEP 1: Determine search location (blood bank or hospital)
    let searchLocation = null;
    if (bloodBankLocation && bloodBankLocation.latitude && bloodBankLocation.longitude) {
      searchLocation = bloodBankLocation;
      console.log(`[SOS] Target: Blood Bank "${bloodBankName}"`);
    } else if (hospitalRequest.hospital_location) {
      searchLocation = hospitalRequest.hospital_location;
      console.log(`[SOS] Target: Hospital Location`);
    } else {
      console.error('[SOS] ❌ No valid location for broadcast');
      return {
        donorsNotified: 0,
        recordsCreated: 0,
        geocodeFailed: true,
        error: 'No location available'
      };
    }

    // 🔧 STEP 2: Geocode if needed (convert address to coordinates)
    let latitude = searchLocation.latitude;
    let longitude = searchLocation.longitude;

    if (!latitude || !longitude) {
      console.log('[SOS] 🌍 Geocoding location from address...');
      try {
        const geocoded = await geocodeLocation(searchLocation);
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
        console.log(`[SOS] ✅ Geocoded: [${longitude}, ${latitude}]`);
      } catch (geocodeError) {
        console.error('[SOS] ❌ Geocoding failed:', geocodeError.message);
        return {
          donorsNotified: 0,
          recordsCreated: 0,
          geocodeFailed: true,
          error: geocodeError.message
        };
      }
    }

    // 🔧 STEP 3: Find nearby donors
    const radiusKm = hospitalRequest.search_radius || 10;
    console.log(`[SOS] 🔍 Searching for donors within ${radiusKm}km...`);

    let nearbyDonors = [];
    try {
      nearbyDonors = await findNearbyDonors(
        longitude,
        latitude,
        hospitalRequest.blood_type,
        radiusKm,
        100 // Max 100 donors
      );
    } catch (searchError) {
      console.error('[SOS] ❌ Donor search failed:', searchError.message);
      return {
        totalDonorsFound: 0,
        donorsNotified: 0,
        recordsCreated: 0,
        failuresCount: 0,
        geocodeFailed: false,
        error: searchError.message
      };
    }

    if (nearbyDonors.length === 0) {
      console.log('[SOS] ⚠️ No donors found');
      return {
        totalDonorsFound: 0,
        donorsNotified: 0,
        recordsCreated: 0,
        failuresCount: 0,
        geocodeFailed: false,
        message: 'No donors available'
      };
    }

    console.log(`[SOS] ✅ Found ${nearbyDonors.length} potential donors`);

    // 🔧 STEP 4: Send FCM notifications and create contact requests
    console.log('[SOS] 📢 Sending notifications and creating records...');

    let donorsFCMSent = 0;
    let recordsCreated = 0;
    let failuresCount = 0;

    for (const donor of nearbyDonors) {
      try {
        // Send FCM notification with blood bank address
        const notificationTitle = `🆘 URGENT - Need Blood Donation Now`;
        const bloodbankAddress = bloodBankLocation?.address || 'your nearest blood bank';
        const notificationBody = `🚨 URGENT: ${bloodBankName} needs ${hospitalRequest.blood_type} blood. Visit: ${bloodbankAddress}`;

        const fcmData = {
          type: 'SOS_DONOR_BROADCAST',
          requestId: hospitalRequest._id.toString(),
          hospitalId: hospitalRequest.hospital_id.toString(),
          bloodType: hospitalRequest.blood_type,
          unitsNeeded: hospitalRequest.units_requested.toString(),
          urgencyLevel: hospitalRequest.urgency_level,
          isEmergency: 'true',
          latitude: latitude.toString(),
          longitude: longitude.toString()
        };

        const fcmSuccess = await sendFCMToDonor(
          donor,
          { title: notificationTitle, body: notificationBody },
          fcmData
        );

        if (fcmSuccess) {
          donorsFCMSent++;

          // Create DonorContactRequest record
          try {
            await DonorContactRequest.create({
              donorId: new mongoose.Types.ObjectId(donor._id),
              requesterId: new mongoose.Types.ObjectId(hospitalRequest.hospital_id),
              requestId: new mongoose.Types.ObjectId(hospitalRequest._id),
              hospitalId: new mongoose.Types.ObjectId(hospitalRequest.hospital_id),
              requestType: 'EMERGENCY',
              sourceType: 'emergency_broadcast',
              bloodType: hospitalRequest.blood_type,
              quantity: hospitalRequest.units_requested || 1,
              urgencyLevel: (hospitalRequest.urgency_level || 'medium').charAt(0).toUpperCase() + (hospitalRequest.urgency_level || 'medium').slice(1),
              status: 'pending',
              message: `Emergency blood request: ${hospitalRequest.blood_type} type needed urgently`,
              expiresAt: createExpiryDate(24)  // ✅ FIX: Use timezone-safe date utility (24 hours)
            });
            recordsCreated++;
            console.log(`[SOS] ✅ Created DonorContactRequest for donor ${donor._id}`);
          } catch (dbError) {
            console.error(`[SOS] ❌ Error creating DonorContactRequest:`, dbError.message);
            failuresCount++;
          }
        } else {
          failuresCount++;
        }
      } catch (donorError) {
        console.error(`[SOS] Error processing donor ${donor._id}:`, donorError.message);
        failuresCount++;
      }
    }

    console.log(`[SOS] ✅ Broadcast complete: ${nearbyDonors.length} found, ${donorsFCMSent} FCM sent, ${recordsCreated} DB records created`);
    console.log('='.repeat(70) + '\n');

    // ✅ CONSISTENT: Return object with all metrics
    return {
      totalDonorsFound: nearbyDonors.length,
      donorsNotified: donorsFCMSent,
      recordsCreated,
      failuresCount,
      geocodeFailed: false
    };
  } catch (error) {
    console.error('[SOS] ❌ Fatal error in broadcastSOSToNearbyDonors:', error);
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
 * 📊 UPDATE REQUEST: Mark geosearch as triggered and save broadcast info
 * @param {string} requestId - HospitalRequest ID
 * @param {object} broadcastResult - Result from broadcastSOSToNearbyDonors
 * @returns {Promise<object>} - Updated request document
 */
export async function updateRequestWithBroadcastInfo(requestId, broadcastResult) {
  try {
    console.log(`[UPDATE-REQUEST] Updating request ${requestId} with broadcast info...`);

    const HospitalRequest = require('@/models/HospitalRequest.js').default;

    const updated = await HospitalRequest.findByIdAndUpdate(
      requestId,
      {
        geosearch_triggered: true,
        donors_notified: broadcastResult.donorsNotified || 0,
        last_notification_sent: new Date(),
        sos_broadcast_status: broadcastResult.geocodeFailed ? 'geocoding_failed' : 'completed',
        sos_error_message: broadcastResult.error || null
      },
      { new: true, runValidators: false }
    );

    if (!updated) {
      throw new Error(`Request not found: ${requestId}`);
    }

    console.log(
      `[UPDATE-REQUEST] ✅ Updated: geosearch_triggered=true, donors_notified=${broadcastResult.donorsNotified}`
    );

    return updated;
  } catch (error) {
    console.error('[UPDATE-REQUEST] ❌ Error updating request:', error.message);
    throw error;
  }
}

export { sendFCMToDonor };
