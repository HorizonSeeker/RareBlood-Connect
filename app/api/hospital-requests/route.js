import connectDB from '@/db/connectDB.mjs';
import mongoose from 'mongoose';
import BloodInventory from '@/models/BloodInventory.js';
import Doner from '@/models/Doner.js';
import DonorContactRequest from '@/models/DonorContactRequest.js';
import HospitalInventory from '@/models/HospitalInventory.js';
import HospitalInventoryLog from '@/models/HospitalInventoryLog.js';
import HospitalRequest from '@/models/HospitalRequest.js';
import User from '@/models/User.js';
import { NextResponse } from 'next/server';
import { ensureHospitalVerified } from '@/lib/roleAuth';
import { getAuthToken } from '@/lib/authMiddleware';
import {
  broadcastSOSToNearbyDonors,
  notifyBloodBankViaPusher,
  findNearestBloodBanks
} from '@/lib/fcmNotificationService.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET - Fetch hospital requests
export async function GET(req) {
  try {
    await connectDB();
    
    const token = await getAuthToken(req);
    if (!token) {
      console.error('❌ [hospital-requests GET] No authentication token found');
      console.error('Headers:', req.headers);
      return NextResponse.json({ 
        error: 'Unauthorized - Please login or provide Bearer token',
        debug: 'No token found in cookies or authorization header'
      }, { status: 401 });
    }

    console.log('✅ [hospital-requests GET] Token found:', token);

    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const userId = token.userId || token.sub;
    
    console.log(`📋 [hospital-requests GET] Fetching ${role} requests for userId:`, userId);

    let filter = {};
    
    if (role === 'hospital') {
      // Hospitals see only their own requests
      filter.hospital_id = userId;
    } else if (role === 'bloodbank') {
      // Blood banks see only requests directed specifically to them
      filter.bloodbank_id = userId;
    } else {
      return NextResponse.json({ error: 'Invalid role specified' }, { status: 400 });
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    const requests = await HospitalRequest.find(filter)
      .populate('hospital_id', 'name email')
      .populate('bloodbank_id', 'name email')
      .populate('responded_by', 'name email')
      .sort({ created_at: -1 })
      .lean(); // 🔑 CRITICAL FIX: Convert to plain JS objects so assigned fields survive JSON.stringify

    // Populate responders separately to get donor details from Doner model
    for (let request of requests) {
      try {
        if (request.responders && request.responders.length > 0) {
          const populatedResponders = [];
          for (let responder of request.responders) {
            try {
              const donor = await Doner.findOne({ user_id: responder.donorId });
              const user = await User.findById(responder.donorId);
              populatedResponders.push({
                donorId: {
                  _id: user?._id,
                  name: user?.name,
                  email: user?.email
                },
                donor: {
                  blood_type: donor?.blood_type,
                  phone: donor?.mobile_number
                },
                respondedAt: responder.respondedAt
              });
            } catch (responderErr) {
              console.error(`Error populating responder ${responder.donorId}:`, responderErr);
            }
          }
          request.responders = populatedResponders;
        }

        // 🔗 NEW: Fetch SOS donor details (all notified donors, not just responders)
        // This populates the 'SOS Donors' column on Frontend table
        try {
          // ✅ FIX: Check for NEW field names (database_records_created >= 0)
          if (request.sos_broadcasted?.database_records_created >= 0 && 
              request.sos_broadcasted?.database_records_created > 0) {
            console.log(`[SOS Query] ==========================================`);
            console.log(`[SOS Query] Request ID: ${request._id}`);
            console.log(`[SOS Query] Stored metrics: Total=${request.sos_broadcasted.total_donors_found}, FCM=${request.sos_broadcasted.donors_fcm_sent}, DB=${request.sos_broadcasted.database_records_created}`);
            console.log(`[SOS Query] Searching DonorContactRequest with requestId...`);
            
            // Try querying by requestId first (new records)
            let donorContactRequests = await DonorContactRequest.find({ 
              requestId: request._id 
            });

            console.log(`[SOS Query] Step 1 - Found ${donorContactRequests.length} DonorContactRequest records`);

            // ✅ FIX: Count actual records for verification
            const actualDonorContactCount = donorContactRequests.length;

            if (donorContactRequests.length === 0) {
              console.log(`[SOS Query] Fallback: Trying by hospitalId + recent timestamp...`);
              
              const broadcastTime = new Date(request.sos_broadcasted.broadcasted_at);
              // 🔧 FIX: Increase time window from 3 mins to 15 mins for better tolerance
              const timeWindowStart = new Date(broadcastTime.getTime() - 15 * 60 * 1000); 
              const timeWindowEnd = new Date(broadcastTime.getTime() + 15 * 60 * 1000);

              console.log(`[SOS Query] Time range: ${timeWindowStart.toISOString()} to ${timeWindowEnd.toISOString()}`);

              donorContactRequests = await DonorContactRequest.find({
                hospitalId: request.hospital_id,
                bloodType: request.blood_type,
                createdAt: { $gte: timeWindowStart, $lte: timeWindowEnd }
              }).limit(200);

              console.log(`[SOS Query] Fallback found ${donorContactRequests.length} records in time window`);
            }

            // 🔧 NEW: Log recommendation if still 0
            if (donorContactRequests.length === 0 && request.sos_broadcasted?.database_records_created > 0) {
              console.warn(`[SOS Query] ⚠️  WARNING: Stored DB count=${request.sos_broadcasted.database_records_created}, but query found 0!`);
              console.warn(`[SOS Query]    This suggests records may be stored under different requestId or criteria`);
              console.warn(`[SOS Query]    Attempting direct MongoDB count...`);
              
              // Try direct count
              try {
                const directCount = await DonorContactRequest.countDocuments({
                  requestId: request._id
                });
                console.log(`[SOS Query] Direct count query: ${directCount} records`);
              } catch (countErr) {
                console.error(`[SOS Query] Error in direct count:`, countErr.message);
              }
            }

            // 🔑 Now populate each record separately with error handling
            const populatedDonors = [];
            console.log(`[SOS Query] Populating ${donorContactRequests.length} donor contact requests...`);
            
            for (let dcr of donorContactRequests) {
              try {
                console.log(`[SOS Query] Processing record ${dcr._id}, donorId: ${dcr.donorId}, type: ${typeof dcr.donorId}`);
                
                // 🔧 FIX: Ensure we're using ObjectId
                const donorIdObj = dcr.donorId instanceof mongoose.Types.ObjectId ? 
                  dcr.donorId : 
                  new mongoose.Types.ObjectId(dcr.donorId);
                
                // Fetch Doner with nested User populate
                const donor = await Doner.findById(donorIdObj)
                  .populate('user_id', 'name email phone');

                if (!donor) {
                  console.warn(`[SOS Query] ⚠️ Donor not found for ID: ${donorIdObj} (original: ${dcr.donorId})`);
                  continue;
                }

                if (!donor.user_id) {
                  console.warn(`[SOS Query] ⚠️ User reference not found for donor ${donorIdObj}`);
                  continue;
                }

                populatedDonors.push({
                  _id: donor._id,
                  name: donor.user_id?.name || 'Unknown',
                  email: donor.user_id?.email,
                  phone: donor.mobile_number || donor.user_id?.phone,
                  blood_type: donor.blood_type,
                  response_status: dcr.status,
                  contactedAt: dcr.createdAt
                });

                console.log(`[SOS Query] ✅ Added donor: ${donor.user_id?.name}`);
              } catch (popErr) {
                console.error(`[SOS Query] Error populating donor ${dcr.donorId}:`, popErr.message);
              }
            }

            request.sos_donor_details = populatedDonors;
            
            // ✅ FIX: Add reality check and mismatch detection
            const recordsCreatedStored = request.sos_broadcasted.database_records_created || 0;
            const fcmSentStored = request.sos_broadcasted.donors_fcm_sent || 0;
            const actualPopulatedCount = populatedDonors.length;
            
            // Detect mismatches
            if (actualDonorContactCount !== recordsCreatedStored) {
              console.warn(`⚠️  MISMATCH ALERT: Stored DB records (${recordsCreatedStored}) != Actual DB records (${actualDonorContactCount})`);
            }
            if (actualPopulatedCount !== actualDonorContactCount) {
              console.warn(`⚠️  POPULATION ISSUE: Actual DB records (${actualDonorContactCount}) != Successfully populated (${actualPopulatedCount})`);
            }
            
            // Add metrics for frontend verification
            request.sos_donor_metrics = {
              stored_db_records: recordsCreatedStored,
              stored_fcm_sent: fcmSentStored,
              actual_db_records: actualDonorContactCount,
              populated_donors: actualPopulatedCount,
              mismatch_detected: actualDonorContactCount !== recordsCreatedStored
            };
            
            console.log(`[SOS Query] ✅ Final result: ${actualPopulatedCount} donors populated (${actualDonorContactCount} DB records found)`);
            console.log(`[SOS Query] Metrics: Stored DB=${recordsCreatedStored}, Actual DB=${actualDonorContactCount}, Populated=${actualPopulatedCount}`);
            console.log(`[SOS Query] ==========================================\n`);
          } else {
            request.sos_donor_details = [];
          }
        } catch (sosErr) {
          console.error(`Error fetching SOS donor details for request ${request._id}:`, sosErr);
          request.sos_donor_details = [];
        }
      } catch (requestErr) {
        console.error(`Error processing request ${request._id}:`, requestErr);
      }
    }

    return NextResponse.json({ 
      success: true, 
      requests,
      count: requests.length 
    });

  } catch (error) {
    // ✅ FIX: Provide better error context with structured error info
    const errorContext = {
      step: 'hospital-requests GET',
      message: error?.message || 'Unknown error',
      name: error?.name,
      code: error?.code,
      timestamp: new Date().toISOString()
    };
    
    // Different handling based on error type
    if (error?.name === 'MongoNetworkError' || error?.name === 'MongoServerSelectionError') {
      console.error('[ERROR] Database connection failed:', errorContext);
      return NextResponse.json({ 
        error: 'Database connection failed',
        errorCode: 'DB_CONNECTION_FAILED',
        requestId: 'see-logs'
      }, { status: 503 });
    }
    
    if (error?.name === 'ValidationError') {
      console.error('[ERROR] Validation error:', errorContext);
      return NextResponse.json({ 
        error: 'Invalid request data',
        errorCode: 'VALIDATION_ERROR',
        details: error.message.substring(0, 200)
      }, { status: 400 });
    }
    
    console.error('[ERROR] Unexpected error fetching hospital requests:', errorContext);
    return NextResponse.json({ 
      error: 'Failed to fetch requests',
      errorCode: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Please check server logs'
    }, { status: 500 });
  }
}

// POST - Create new hospital request
export async function POST(req) {
  try {
    await connectDB();
    
    // ✅ FIX: Add request size limit to prevent DoS attacks
    const contentLength = parseInt(req.headers.get('content-length') || '0');
    const maxSizeKB = 10; // 10KB limit
    
    if (contentLength > maxSizeKB * 1024) {
      return NextResponse.json(
        {
          error: 'Request body too large',
          errorCode: 'REQUEST_TOO_LARGE',
          maxSize: `${maxSizeKB}KB`,
          received: `${(contentLength / 1024).toFixed(2)}KB`
        },
        { status: 413 }
      );
    }
    
    const token = await getAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - Please login or provide Bearer token' }, { status: 401 });
    }

    const userId = token.userId || token.sub;
    // Verify user is a hospital
    const user = await User.findById(userId);
    if (!user || user.role !== 'hospital') {
      return NextResponse.json({ error: 'Access denied. Hospital role required.' }, { status: 403 });
    }

    // Ensure hospital is verified per SOP12
    const hv = await ensureHospitalVerified(userId);
    if (!hv.success) {
      return NextResponse.json({ error: hv.error, verification_status: hv.verification_status, notes: hv.notes }, { status: hv.status });
    }

    const data = await req.json();
    
    // ⛔ REJECT: Hospitals cannot create generic emergency requests
    // ✅ ALLOW: Patient-specific emergency requests (e.g., car accident, sudden condition)
    if ((data.is_emergency === true || data.is_emergency === 'true') && data.request_type !== 'patient') {
      return NextResponse.json({ 
        error: 'Generic emergency blood requests are not available for hospitals. Use patient-specific emergency requests instead.' 
      }, { status: 403 });
    }
    
    const {
      is_emergency,
      compatible_blood_types,
      patient_details,
      reason,
      hospital_location,
      search_radius,
      user_latitude,
      user_longitude,
      location_accuracy,
      location_source,
      bloodbank_id,
      request_type,
      blood_type,
      units_requested,
      urgency_level
    } = data;

    // Validation
    if (!bloodbank_id || !request_type || !blood_type || !units_requested || !reason) {
      return NextResponse.json({ 
        error: 'Missing required fields: bloodbank_id, request_type, blood_type, units_requested, reason' 
      }, { status: 400 });
    }

    // Verify blood bank exists
    const bloodBank = await User.findById(bloodbank_id);
    if (!bloodBank || bloodBank.role !== 'bloodbank_admin') {
      return NextResponse.json({ error: 'Invalid blood bank ID' }, { status: 400 });
    }

    // Validate patient details if request type is patient
    if (request_type === 'patient') {
      if (!patient_details?.name || !patient_details?.age || !patient_details?.condition) {
        return NextResponse.json({ 
          error: 'Patient details (name, age, condition) are required for patient requests' 
        }, { status: 400 });
      }
    }

    // ✅ LOCATION VALIDATION: Emergency requests MUST have valid coordinates
    if (is_emergency === true || is_emergency === 'true') {
      const hasUserLocation = user_latitude && user_longitude;
      const hasHospitalLocation = hospital_location?.latitude && hospital_location?.longitude;
      
      if (!hasUserLocation && !hasHospitalLocation) {
        return NextResponse.json({
          error: 'Emergency requests require valid location data. Please provide GPS coordinates or hospital address.',
          errorCode: 'LOCATION_REQUIRED',
          details: {
            userLocationProvided: hasUserLocation,
            hospitalLocationProvided: hasHospitalLocation,
            message: 'At least one of user location (GPS) or hospital location must be provided'
          }
        }, { status: 400 });
      }

      // Validate coordinates are within valid ranges
      if (hasUserLocation) {
        const lat = parseFloat(user_latitude);
        const lon = parseFloat(user_longitude);
        
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          return NextResponse.json({
            error: 'Invalid user location coordinates',
            errorCode: 'INVALID_COORDINATES',
            details: { latitude: lat, longitude: lon }
          }, { status: 400 });
        }
      }

      if (hasHospitalLocation) {
        const lat = hospital_location.latitude;
        const lon = hospital_location.longitude;
        
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          return NextResponse.json({
            error: 'Invalid hospital location coordinates',
            errorCode: 'INVALID_COORDINATES',
            details: { latitude: lat, longitude: lon }
          }, { status: 400 });
        }
      }
    }

    // Create the request
    const hospitalRequest = new HospitalRequest({
      hospital_id: userId,
      bloodbank_id,
      request_type,
      blood_type,
      units_requested: parseInt(units_requested),
      urgency_level: urgency_level || 'medium',
      is_emergency: is_emergency || false,
      compatible_blood_types: compatible_blood_types || [],
      patient_details: request_type === 'patient' ? patient_details : undefined,
      reason,
      hospital_location: hospital_location || {},
      search_radius: search_radius || 10,
      user_latitude: user_latitude ? parseFloat(user_latitude) : null,
      user_longitude: user_longitude ? parseFloat(user_longitude) : null,
      location_accuracy: location_accuracy ? parseFloat(location_accuracy) : null,
      location_source: location_source || 'fallback'
    });

    await hospitalRequest.save();

    // Populate the created request for response
    await hospitalRequest.populate('hospital_id', 'name email');
    await hospitalRequest.populate('bloodbank_id', 'name email');

    // Send real-time notification via Pusher (BLOCKING - must succeed)
    try {
      const PusherModule = await import('pusher');
      const Pusher = PusherModule.default || PusherModule;
      const pusher = new Pusher({
        appId: process.env.PUSHER_APP_ID,
        key: process.env.NEXT_PUBLIC_PUSHER_KEY,
        secret: process.env.PUSHER_SECRET,
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
        useTLS: true,
      });

      console.log("📤 Sending notification to Pusher for blood bank...");
      // ✅ NULL SAFETY: Add defensive checks for Pusher notification data
      const notificationMessage = hospitalRequest?.blood_type && hospitalRequest?.units_requested
        ? `🆘 New blood request from hospital (${hospitalRequest.blood_type}) — ${hospitalRequest.units_requested} unit(s)`
        : `🆘 New blood request from hospital`;
      
      await pusher.trigger('blood-channel', 'new-alert', {
        message: notificationMessage,
        requestId: hospitalRequest?._id?.toString(),
        hospitalId: hospitalRequest?.hospital_id?.toString(),
        bloodbankId: hospitalRequest?.bloodbank_id?.toString(),
        isEmergency: !!hospitalRequest?.is_emergency
      });
      console.log("✅ Pusher notification sent successfully!");
    } catch (err) {
      console.error('❌ Pusher trigger error:', err);
      // Log but don't fail the API response - notification can be retried
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Hospital request created successfully',
      request: hospitalRequest 
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating hospital request:', error);
    return NextResponse.json({ 
      error: 'Failed to create request',
      details: error.message 
    }, { status: 500 });
  }
}

// PUT - Update request status (accept/reject)
export async function PUT(req) {
  try {
    await connectDB();
    
    const token = await getAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - Please login or provide Bearer token' }, { status: 401 });
    }

    const userId = token.userId || token.sub;
    // Verify user is a blood bank admin
    const user = await User.findById(userId);
    if (!user || user.role !== 'bloodbank_admin') {
      return NextResponse.json({ error: 'Access denied. Blood bank admin role required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get('id');
    
    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    const data = await req.json();
    const { status, response_message, delivery_info } = data;

    if (!status || !['accepted', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Valid status (accepted/rejected) is required' }, { status: 400 });
    }

    // Validate delivery_info when accepting
    if (status === 'accepted') {
      if (!delivery_info || !delivery_info.estimated_minutes || !delivery_info.driver_name || !delivery_info.driver_phone) {
        return NextResponse.json({ 
          error: 'Delivery information required (estimated_minutes, driver_name, driver_phone)',
          errorCode: 'DELIVERY_INFO_REQUIRED'
        }, { status: 400 });
      }

      // Validate delivery_info fields
      if (delivery_info.estimated_minutes < 1 || delivery_info.estimated_minutes > 1440) {
        return NextResponse.json({ 
          error: 'Estimated minutes must be between 1 and 1440 (24 hours)',
          errorCode: 'INVALID_ESTIMATED_MINUTES'
        }, { status: 400 });
      }

      if (!delivery_info.driver_name.trim() || !delivery_info.driver_phone.trim()) {
        return NextResponse.json({ 
          error: 'Driver name and phone cannot be empty',
          errorCode: 'EMPTY_DRIVER_INFO'
        }, { status: 400 });
      }

      // ✅ PHONE VALIDATION: Ensure valid phone number format
      const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
      if (!phoneRegex.test(delivery_info.driver_phone.replace(/\s/g, ''))) {
        return NextResponse.json({
          error: 'Invalid phone number format. Please provide a valid phone number (e.g., +1-800-555-0123 or 0912345678)',
          errorCode: 'INVALID_PHONE_FORMAT',
          details: { phoneProvided: delivery_info.driver_phone }
        }, { status: 400 });
      }

      // ✅ DRIVER NAME VALIDATION: Length and character restrictions
      if (delivery_info.driver_name.length < 2 || delivery_info.driver_name.length > 100) {
        return NextResponse.json({
          error: 'Driver name must be between 2 and 100 characters',
          errorCode: 'INVALID_NAME_LENGTH'
        }, { status: 400 });
      }

      // Check for suspicious characters in driver name (basic security)
      const nameRegex = /^[a-zA-Z0-9\s\-'.]+$/;
      if (!nameRegex.test(delivery_info.driver_name)) {
        return NextResponse.json({
          error: 'Driver name contains invalid characters. Use only letters, numbers, spaces, hyphens, and apostrophes.',
          errorCode: 'INVALID_NAME_FORMAT'
        }, { status: 400 });
      }
    }

    // Find the request
    const hospitalRequest = await HospitalRequest.findById(requestId);
    if (!hospitalRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Verify the blood bank is the one responding
    if (hospitalRequest.bloodbank_id.toString() !== userId) {
      return NextResponse.json({ error: 'Unauthorized to respond to this request' }, { status: 403 });
    }

    if (hospitalRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Request has already been processed' }, { status: 400 });
    }

    // If accepting, check inventory and update accordingly
    if (status === 'accepted') {
      // Save delivery info with confirmation timestamp
      hospitalRequest.delivery_info = {
        estimated_minutes: delivery_info.estimated_minutes,
        driver_name: delivery_info.driver_name,
        driver_phone: delivery_info.driver_phone,
        confirmed_at: new Date()
      };

      // 🚨 EMERGENCY BYPASS: Check if this is an emergency request
      if (hospitalRequest.is_emergency === true) {
        console.log('🚨 ACTIVATE SOS FOR EMERGENCY CASE!');
        console.log('⏭️  SKIP INVENTORY CHECK - PRIORITIZE FINDING DONORS NOW');
        
        // For emergency: Skip inventory checks and deduction
        // Status stays as 'accepted' (not 'fulfilled' yet)
        // Inventory updates will happen after donor confirmation
        hospitalRequest.status = 'accepted';
      } else {
        // Non-emergency: Perform strict inventory validation and deduction
        // ✅ ATOMIC OPERATION: Prevent race condition with concurrent requests
        const inventory = await BloodInventory.findOne({
          bloodbank_id: userId,
          blood_type: hospitalRequest.blood_type
        });

        if (!inventory) {
          return NextResponse.json({ 
            error: 'Blood inventory not found for this blood type' 
          }, { status: 400 });
        }

        // ✅ Use atomic $inc operator - eliminates race condition window
        const updatedInventory = await BloodInventory.findByIdAndUpdate(
          inventory._id,
          {
            $inc: { units_available: -hospitalRequest.units_requested }
          },
          { new: true, runValidators: true }
        );

        // Verify the update didn't result in negative inventory
        if (!updatedInventory || updatedInventory.units_available < 0) {
          // Rollback: Increment back to restore state
          await BloodInventory.findByIdAndUpdate(
            inventory._id,
            { $inc: { units_available: hospitalRequest.units_requested } }
          );
          
          return NextResponse.json({ 
            error: 'Insufficient blood units available - inventory exhausted by another request',
            errorCode: 'RACE_CONDITION_DETECTED'
          }, { status: 409 });  // 409 Conflict
        }

        // If request is for inventory (not patient), add to hospital inventory
        if (hospitalRequest?.request_type === 'inventory') {
          // ✅ NULL SAFETY: Validate hospital_id and blood_type exist
          if (!hospitalRequest?.hospital_id || !hospitalRequest?.blood_type) {
            console.warn('⚠️  Cannot create hospital inventory: missing hospital_id or blood_type');
          } else {
            let hospitalInventory = await HospitalInventory.findOne({
              hospital_id: hospitalRequest.hospital_id,
              blood_type: hospitalRequest.blood_type
            });

            if (hospitalInventory) {
              const unitsToAdd = parseInt(hospitalRequest.units_requested) || 0;
              if (unitsToAdd > 0) {
                hospitalInventory.units_available += unitsToAdd;
                await hospitalInventory.save();
              }
            } else {
              // Create new hospital inventory entry
              const unitsToAdd = parseInt(hospitalRequest.units_requested) || 0;
              if (unitsToAdd > 0) {
                hospitalInventory = new HospitalInventory({
                  hospital_id: hospitalRequest.hospital_id,
                  blood_type: hospitalRequest.blood_type,
                  units_available: unitsToAdd,
                  expiry_date: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000), // 42 days from now
                  batch_number: `BB-${Date.now()}`,
                  minimum_stock_level: 5,
                  maximum_capacity: 100
                });
                await hospitalInventory.save();
              }
            }
          }

          // Log the inventory change
          if (hospitalInventory) {
            const inventoryLog = new HospitalInventoryLog({
              hospital_id: hospitalRequest.hospital_id,
              blood_type: hospitalRequest.blood_type,
              action: 'received',
              units_changed: hospitalRequest.units_requested,
              previous_units: hospitalInventory.units_available - hospitalRequest.units_requested,
              new_units: hospitalInventory.units_available,
              reason: `Blood received from blood bank request #${hospitalRequest._id}`,
              performed_by: userId
            });
            await inventoryLog.save();
          }
        }

        // Update request status to fulfilled for accepted non-emergency requests
        hospitalRequest.status = 'fulfilled';
      }
    } else if (status === 'rejected') {
      // ⚠️ REJECTION LOGIC: Check if this is an emergency request
      // ✅ FIX: Properly normalize boolean value  (should be boolean due to schema, but be defensive)
      const isEmergency = hospitalRequest.is_emergency === true || 
                          hospitalRequest.is_emergency === 'true' ||
                          Boolean(hospitalRequest.is_emergency);
      
      if (isEmergency) {
        console.log(`🚨 EMERGENCY REQUEST REJECTED - Triggering AUTO-ROUTING for request ${hospitalRequest._id}`);
        
        // Initialize forwarded_to array if not exists
        if (!hospitalRequest.forwarded_to) {
          hospitalRequest.forwarded_to = [];
        }
        
        // Mark blood bank as forwarded
        hospitalRequest.forwarded_to.push({
          bloodbank_id: userId,
          forwarded_at: new Date(),
          status: 'rejected',
          reason: response_message
        });

        // 🔴 CRITICAL: Change status to 'auto_routing' instead of 'rejected'
        hospitalRequest.status = 'auto_routing';
        console.log(`✅ Status changed to: ${hospitalRequest.status}`);
      } else {
        // Non-emergency: Simply reject
        hospitalRequest.status = 'rejected';
        console.log(`ℹ️  Non-emergency request rejected normally for request ${hospitalRequest._id}`);
      }
    } else {
      hospitalRequest.status = status;
    }

    hospitalRequest.response_message = response_message;
    hospitalRequest.responded_by = userId;
    hospitalRequest.responded_at = new Date();

    await hospitalRequest.save();

    // Populate for response
    await hospitalRequest.populate('hospital_id', 'name email');
    await hospitalRequest.populate('bloodbank_id', 'name email');
    await hospitalRequest.populate('responded_by', 'name email');

    // Prepare response with emergency flag if applicable
    const response = {
      success: true, 
      message: `Request ${status} successfully`,
      request: hospitalRequest
    };

    // Add emergency broadcast flag if this was an accepted emergency request
    if (status === 'accepted' && hospitalRequest.is_emergency === true) {
      response.trigger_emergency_broadcast = true;
    }

    // Store for auto-routing response
    let autoRoutingData = {
      donorsNotified: 0,
      bloodBankForwarded: null
    };

    // Send Pusher notification with delivery info if accepted
    // AND handle auto-routing for rejected emergency requests
    // ✅ FIX: Make this BLOCKING for emergency rejections, non-blocking for normal operations
    const sendPusherNotifications = async () => {
      try {
        const PusherModule = await import('pusher');
        const Pusher = PusherModule.default || PusherModule;
        const pusher = new Pusher({
          appId: process.env.PUSHER_APP_ID,
          key: process.env.NEXT_PUBLIC_PUSHER_KEY,
          secret: process.env.PUSHER_SECRET,
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
          useTLS: true,
        });

        if (status === 'accepted') {
          console.log('📬 Sending delivery info update to hospital via Pusher...');
          await pusher.trigger('blood-channel', 'request-accepted', {
            message: `✅ Blood request ${hospitalRequest.blood_type} has been approved!`,
            requestId: hospitalRequest._id,
            hospitalId: hospitalRequest.hospital_id,
            bloodbankId: hospitalRequest.bloodbank_id,
            status: hospitalRequest.status,
            deliveryInfo: {
              estimatedMinutes: hospitalRequest.delivery_info.estimated_minutes,
              driverName: hospitalRequest.delivery_info.driver_name,
              driverPhone: hospitalRequest.delivery_info.driver_phone,
              confirmedAt: hospitalRequest.delivery_info.confirmed_at
            }
          });
          console.log('✅ Delivery info sent!');
        } else if (status === 'rejected' && hospitalRequest.status === 'auto_routing') {
          // 🚨 AUTO-ROUTING: Emergency rejected, trigger auto-routing
          console.log('\n🚨 AUTO-ROUTING TRIGGERED FOR EMERGENCY REQUEST');
          console.log('='.repeat(60));
          
          let searchLocation = null;
          if (hospitalRequest.user_latitude && hospitalRequest.user_longitude) {
            searchLocation = {
              latitude: hospitalRequest.user_latitude,
              longitude: hospitalRequest.user_longitude,
              address: hospitalRequest.hospital_location?.address || 'Emergency Location'
            };
            console.log(`📍 Using user location: [${searchLocation.longitude}, ${searchLocation.latitude}]`);
          } else if (hospitalRequest.hospital_location?.latitude && hospitalRequest.hospital_location?.longitude) {
            searchLocation = hospitalRequest.hospital_location;
            console.log(`📍 Using hospital location: [${searchLocation.longitude}, ${searchLocation.latitude}]`);
          }
          
          if (!searchLocation) {
            console.error('❌ CRITICAL: No valid location found for auto-routing!');
            // ✅ FIX: Don't silently use (0,0) - this broadcasts to wrong location
            // Emergency requests should have been validated at creation time
            return NextResponse.json({
              error: 'Emergency request missing location data - cannot trigger auto-routing',
              errorCode: 'MISSING_LOCATION_FOR_AUTOROUTING',
              details: {
                userLocation: {
                  latitude: hospitalRequest.user_latitude,
                  longitude: hospitalRequest.user_longitude
                },
                hospitalLocation: hospitalRequest.hospital_location
              }
            }, { status: 400 });
          }
          
          const excludedIds = hospitalRequest.forwarded_to.map(f => f.bloodbank_id);
          
          console.log('🏥 Step 1: Finding nearest alternative blood bank...');
          const nearestBanks = await findNearestBloodBanks(
            searchLocation,
            [...excludedIds, userId],
            hospitalRequest.blood_type,
            50
          );
          
          let nextBloodBank = null;
          if (nearestBanks.length > 0) {
            nextBloodBank = nearestBanks[0];
            console.log(`✅ Found blood bank: ${nextBloodBank.name} at [${nextBloodBank.location.coordinates[0]}, ${nextBloodBank.location.coordinates[1]}]`);
          } else {
            console.log('❌ No alternative blood banks available - will broadcast SOS directly to donors');
          }
          
          console.log('📢 Step 2: Broadcasting SOS to donors...');
          let broadcastResult = {
            totalDonorsFound: 0,
            donorsNotified: 0,
            recordsCreated: 0,
            failuresCount: 0
          };
          let sosBloodBankLocation = null;
          
          if (nextBloodBank && nextBloodBank.location) {
            sosBloodBankLocation = {
              longitude: nextBloodBank.location.coordinates[0],
              latitude: nextBloodBank.location.coordinates[1],
              address: nextBloodBank.location.address || nextBloodBank.name
            };
            console.log(`   Broadcasting from blood bank: ${nextBloodBank.name}`);
            
            broadcastResult = await broadcastSOSToNearbyDonors(
              hospitalRequest,
              sosBloodBankLocation,
              nextBloodBank.name || 'Blood Bank',
              10
            );
            
            console.log(`✅ Broadcast Result - Found: ${broadcastResult.totalDonorsFound}, FCM: ${broadcastResult.donorsNotified}, DB: ${broadcastResult.recordsCreated}`);
          } else {
            console.log('⚠️  Fallback: Broadcasting to donors near hospital/user location');
            sosBloodBankLocation = searchLocation;
            
            try {
              broadcastResult = await broadcastSOSToNearbyDonors(
                hospitalRequest,
                sosBloodBankLocation,
                'Emergency Response - Direct Broadcast',
                15
              );
              console.log(`✅ Fallback Result - Found: ${broadcastResult.totalDonorsFound}, FCM: ${broadcastResult.donorsNotified}, DB: ${broadcastResult.recordsCreated}`);
            } catch (broadcastErr) {
              console.error('❌ Error broadcasting SOS in fallback:', broadcastErr.message);
            }
          }
          
          // ✅ FIX: Store ALL metrics with correct field names
          hospitalRequest.sos_broadcasted = {
            triggered: true,
            broadcasted_at: new Date(),
            total_donors_found: broadcastResult.totalDonorsFound,
            donors_notified: broadcastResult.donorsNotified,        // ← Counter for UI display
            donors_fcm_sent: broadcastResult.donorsNotified,         // ← Alias for compatibility
            database_records_created: broadcastResult.database_records_created || 0,
            failures_count: broadcastResult.failuresCount || 0
          };
          
          console.log('[AUTO-ROUTING] 📊 Stored sos_broadcasted:', {
            triggered: true,
            total_donors_found: broadcastResult.totalDonorsFound,
            donors_fcm_sent: broadcastResult.donorsNotified,
            database_records_created: broadcastResult.database_records_created || 0
          });
          
          if (nextBloodBank) {
            hospitalRequest.forwarded_to.push({
              bloodbank_id: nextBloodBank._id,
              forwarded_at: new Date(),
              status: 'pending'
            });
            
            hospitalRequest.bloodbank_id = nextBloodBank._id;
            
            console.log('📬 Sending request to new blood bank via Pusher...');
            await pusher.trigger(`bloodbank-${nextBloodBank._id}`, 'auto-request-forward', {
              message: `🚑 EMERGENCY: Blood request ${hospitalRequest.blood_type} - previous bank rejected`,
              requestId: hospitalRequest._id,
              hospitalId: hospitalRequest.hospital_id,
              hospitalName: (await User.findById(hospitalRequest.hospital_id))?.name || 'Hospital',
              bloodType: hospitalRequest.blood_type,
              unitsNeeded: hospitalRequest.units_requested,
              isEmergency: true,
              donorsAlreadyNotified: broadcastResult.donorsNotified
            });
            
            autoRoutingData.bloodBankForwarded = nextBloodBank.name;
            console.log(`✅ Request forwarded to ${nextBloodBank.name}`);
          } else {
            console.log('⚠️  No blood bank to forward to - donors are being notified directly');
          }
          
          // ✅ FIX: Store all metrics
          autoRoutingData.donorsNotified = broadcastResult.donorsNotified;
          autoRoutingData.totalDonorsFound = broadcastResult.totalDonorsFound;
          autoRoutingData.databaseRecordsCreated = broadcastResult.database_records_created || 0;
          autoRoutingData.failuresCount = broadcastResult.failuresCount || 0;
          
          await hospitalRequest.save();
          
          // 🏥 NOTIFY HOSPITAL ABOUT AUTO-ROUTING COMPLETION WITH DONOR COUNT
          console.log('📬 Sending auto-routing update to hospital via Pusher...');
          await pusher.trigger('blood-channel', 'auto-routing-donors-notified', {
            message: `🚑 Your emergency request triggered auto-routing: ${broadcastResult.donorsNotified} donors have been notified!`,
            requestId: hospitalRequest._id,
            hospitalId: hospitalRequest.hospital_id,
            bloodType: hospitalRequest.blood_type,
            donorsNotified: broadcastResult.donorsNotified,
            totalDonorsFound: broadcastResult.totalDonorsFound,
            status: 'auto_routing',
            nextBloodBank: nextBloodBank ? nextBloodBank.name : 'Direct broadcast to donors',
            timestamp: new Date(),
            sosTriggered: true
          });
          console.log('✅ Auto-routing update sent to hospital!');
          
          console.log('='.repeat(60));
          console.log('🎯 AUTO-ROUTING COMPLETED\n');
          
        } else if (status === 'rejected') {
          console.log('📤 Sending rejection notification to hospital via Pusher...');
          await pusher.trigger('blood-channel', 'request-rejected', {
            message: `❌ Blood request ${hospitalRequest.blood_type} has been rejected.`,
            requestId: hospitalRequest._id,
            hospitalId: hospitalRequest.hospital_id,
            bloodbankId: hospitalRequest.bloodbank_id,
            reason: response_message,
            isEmergency: hospitalRequest.is_emergency
          });
          console.log('✅ Rejection notification sent!');
        }
      } catch (err) {
        console.error('❌ Pusher notification error:', err);
      }
    };

    // ✅ BLOCKING for emergency rejections, non-blocking for others
    if (status === 'rejected' && hospitalRequest.status === 'auto_routing') {
      // Emergency auto-routing MUST complete before returning
      await sendPusherNotifications();
    } else {
      // Non-emergency operations can be async
      sendPusherNotifications().catch(err => console.error('Async notification error:', err));
    }

    // Add auto-routing data to response if triggered
    if (status === 'rejected' && hospitalRequest.status === 'auto_routing') {
      response.autoRouting = {
        totalDonorsFound: autoRoutingData.totalDonorsFound || 0,
        nearbyDonorsNotified: autoRoutingData.donorsNotified || 0,
        databaseRecordsCreated: autoRoutingData.databaseRecordsCreated || 0,
        failuresCount: autoRoutingData.failuresCount || 0,
        bloodBankForwarded: autoRoutingData.bloodBankForwarded
      };
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error updating hospital request:', error);
    return NextResponse.json({ 
      error: 'Failed to update request',
      details: error.message 
    }, { status: 500 });
  }
}
