import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import BloodRequest from "@/models/BloodRequest.js";
import User from "@/models/User.js";
import BloodBank from "@/models/BloodBank.js";
import BloodInventory from "@/models/BloodInventory.js";
import Doner from "@/models/Doner.js";
import { getCompatibleBloodTypes } from "@/lib/bloodCompatibility";
import admin from '@/config/firebase.mjs';
import { getAuthToken } from "@/lib/authMiddleware";

/**
 * CREATE BLOOD REQUEST - FIXED VERSION
 * Implements 5-step business logic with Race Condition protection
 * 
 * 5 Steps:
 * 1. STEP 1: Receive request (blood_type, units_required, location, urgency)
 * 2. STEP 2: Auto-check inventory (Redis cache → MongoDB)
 * 3. STEP 3: Branch 1 - If sufficient: Set APPROVED/PARTIAL + Reserve atomically
 * 4. STEP 4: Branch 2 - If insufficient: Set IN_PROGRESS + Trigger GeoJSON search
 * 5. STEP 5: Real-time notification (Pusher + FCM)
 */
export async function POST(req) {
  const startTime = Date.now();
  
  try {
    await connectDB();
    
    // ====== AUTHENTICATION ======
    console.log("\n🔵 [/api/requests] Received POST request");
    console.log("📋 Request URL:", req.url);
    console.log("📋 Request method:", req.method);
    
    // Log all headers for debugging
    console.log("📋 Request headers:");
    for (const [key, value] of req.headers.entries()) {
      if (key.toLowerCase() === "authorization") {
        console.log(`  ${key}: ${value.substring(0, 30)}...`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }
    
    // Authenticate user - supports BOTH NextAuth (cookie) and Bearer token
    const token = await getAuthToken(req);
    if (!token) {
      console.error(`❌ [/api/requests] Authentication failed: No token found`);
      return NextResponse.json(
        { 
          error: "Unauthorized - Please login or provide Bearer token",
          success: false 
        }, 
        { status: 401 }
      );
    }

    console.log(`✅ [/api/requests] User authenticated via ${token.sub ? 'Bearer' : 'NextAuth'}: ${token.userId || token.sub} (${token.email})`);
    const userId = token.userId || token.sub;
    const userRole = token.role;

    // STEP 1️⃣: RECEIVE REQUEST PAYLOAD
    // ================================
    const body = await req.json();
    const {
      blood_type,
      units_required,
      bloodbank_id,
      request_type,
      urgency_level = 'MEDIUM',
      latitude,
      longitude,
      search_radius_km = 10,
      emergency_contact_name,
      emergency_contact_mobile
    } = body;

    // ====== FLOW ROUTING ======
    // bloodbank_id is OPTIONAL - determines request type
    // - WITH bloodbank_id    → NORMAL FLOW (inventory check + reservation)
    // - WITHOUT bloodbank_id → EMERGENCY FLOW (geospatial search)
    
    // Validation: only blood_type and units_required are always required
    if (!blood_type || !units_required) {
      return NextResponse.json(
        { error: "Missing required fields: blood_type, units_required" },
        { status: 400 }
      );
    }

    if (units_required <= 0) {
      return NextResponse.json(
        { error: "Units required must be positive" },
        { status: 400 }
      );
    }

    // Determine flow type
    const isNormalFlow = !!bloodbank_id;
    const isEmergencyFlow = !bloodbank_id;
    
    console.log(`🔀 [Flow Detection] Normal: ${isNormalFlow}, Emergency: ${isEmergencyFlow}`);
    
    // NORMAL FLOW: Verify bloodbank exists
    let bloodBank = null;
    if (isNormalFlow) {
      bloodBank = await BloodBank.findById(bloodbank_id);
      if (!bloodBank) {
        return NextResponse.json(
          { error: "Blood bank not found" },
          { status: 404 }
        );
      }
      console.log(`✅ [Normal Flow] Blood bank verified: ${bloodBank.name}`);
    } else {
      console.log(`✅ [Emergency Flow] Skipping blood bank validation - will trigger geospatial search`);
    }

    // Get requesting user
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    console.log(`📝 Creating request: ${blood_type} x${units_required} for ${user.role}`);

    // STEP 2️⃣: INVENTORY CHECK (ONLY FOR NORMAL FLOW)
    // ==================================================
    let availableUnits = 0;
    let inventoryId = null;
    let inventorySource = 'none';

    // Only check inventory if normal flow (bloodbank_id provided)
    if (isNormalFlow) {
      // Try Redis first (if configured)
      if (process.env.REDIS_HOST) {
        try {
          // Dynamically require redis to avoid module not found at build time
          let redis;
          try {
            redis = require('redis');
          } catch (moduleErr) {
            if (moduleErr.code === 'MODULE_NOT_FOUND') {
              console.warn('⚠️  [Inventory] Redis module not installed (npm install redis) - skipping cache');
              inventorySource = 'redis_not_installed';
            } else {
              throw moduleErr;
            }
          }

          if (redis) {
            const client = redis.createClient({
              host: process.env.REDIS_HOST,
              port: process.env.REDIS_PORT || 6379,
              socket: { connectTimeout: 2000 }
            });

            client.on('error', err => {
              console.warn('⚠️  Redis connection warning:', err.message);
            });
            
            await client.connect();
            const cacheKey = `bloodbank:${bloodbank_id}:${blood_type}`;
            const cachedValue = await client.get(cacheKey);
            
            if (cachedValue !== null) {
              availableUnits = parseInt(cachedValue);
              inventorySource = 'redis_cache';
              console.log(`✅ [Inventory] Redis hit: ${availableUnits} units from cache`);
            }
            
            await client.quit();
          }
        } catch (redisErr) {
          console.warn(`⚠️  [Inventory] Redis unavailable - falling back to MongoDB:`, redisErr.message);
          inventorySource = 'redis_fallback';
        }
      } else {
        console.log(`ℹ️  [Inventory] Redis not configured - using MongoDB only`);
      }

      // Fallback to MongoDB if Redis miss
      if (inventorySource === 'none') {
        const inventory = await BloodInventory.findOne({
          bloodbank_id,
          blood_type,
          expiry_date: { $gt: new Date() }  // Only non-expired
        })
          .select('_id units_available')
          .sort({ date_of_entry: 1 })  // FIFO: oldest first
          .lean();

        if (inventory) {
          availableUnits = inventory.units_available;
          inventoryId = inventory._id;
          inventorySource = 'mongodb';
          console.log(`✅ [Inventory] MongoDB found: ${availableUnits} units available`);
        } else {
          console.log(`⚠️  [Inventory] No inventory found for ${blood_type}`);
          inventorySource = 'not_found';
        }
      }
    } else {
      // Emergency flow: skip inventory check
      console.log(`⏭️  [Emergency Flow] Skipping inventory check - will trigger geospatial search`);
      inventorySource = 'emergency_flow_skip';
    }

    // STEP 3️⃣: DETERMINE STATUS & RESERVATION
    // ========================================
    let finalStatus = 'IN_REVIEW';
    let reservedUnits = 0;
    let reservationExpiry = null;
    let reservationError = null;

    // NORMAL FLOW: Check inventory and attempt reservation
    if (isNormalFlow) {
      console.log(`🔄 [Normal Flow] Inventory decision tree...`);
      
      // Determine status based on inventory
      if (availableUnits >= units_required * 0.8) {
        // At least 80% available → try to reserve
        finalStatus = availableUnits >= units_required ? 'APPROVED' : 'PARTIAL_APPROVED';

        // CRITICAL SECTION: Atomic reserve to prevent race condition
        if (inventoryId) {
          try {
            console.log(`🔒 Attempting to reserve ${units_required} units (atomic operation)...`);
            
            // Use MongoDB atomic operation to decrement
            const reservationDoc = {
              request_id: new mongoose.Types.ObjectId(),
              units: units_required,
              reserved_at: new Date(),
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)  // 24h expiry
            };

            const updateResult = await BloodInventory.findByIdAndUpdate(
              inventoryId,
              {
                $inc: { units_available: -units_required },  // ← ATOMIC DECREMENT - RACE CONDITION PROTECTION
                $push: { reservations: reservationDoc }
              },
              { 
                new: true,
                runValidators: true,
                session: null
              }
            );

            // Validate the update succeeded and inventory didn't go negative
            if (updateResult && updateResult.units_available >= 0) {
              reservedUnits = units_required;
              reservationExpiry = reservationDoc.expires_at;
              console.log(`✅ Reserved ${units_required} units. Remaining: ${updateResult.units_available}`);
            } else {
              // Race condition detected: stock exhausted
              console.warn('⚠️ Race condition: Stock exhausted during reservation');
              finalStatus = 'IN_PROGRESS';  // Fall back to geo-search
              reservationError = 'Stock exhausted - race condition detected';
            }
          } catch (reserveErr) {
            console.error('❌ Reservation error:', reserveErr.message);
            finalStatus = 'IN_PROGRESS';  // Fall back to geo-search
            reservationError = reserveErr.message;
          }
        }
      } else {
        // Less than 80% available → trigger geo-search
        finalStatus = 'IN_PROGRESS';
        console.log(`📍 Setting status to IN_PROGRESS (available: ${availableUnits}/${units_required})`);
      }
    } else {
      // EMERGENCY FLOW: Always set to IN_PROGRESS to trigger geospatial search
      finalStatus = 'IN_PROGRESS';
      console.log(`🚨 [Emergency Flow] Status set to IN_PROGRESS - will trigger immediate geospatial search`);
    }

    // Create the blood request
    const requestData = {
      blood_type,
      units_required,
      bloodbank_id: bloodbank_id || null,  // Optional for emergency flow
      request_type: request_type || (isNormalFlow ? 'normal' : 'emergency'),
      status: finalStatus,
      urgency_level,
      requested_date: new Date(),
      emergency_contact_name,
      emergency_contact_mobile,
      user_latitude: latitude || null,
      user_longitude: longitude || null,
      search_radius_km: search_radius_km || 10,
      inventory_reserved: {
        units: reservedUnits,
        inventory_id: inventoryId,
        reserved_at: new Date(),
        expired_at: reservationExpiry
      }
    };

    // Set requester field based on role
    if (user.role === 'hospital') {
      requestData.requested_by_hospital = userId;
    } else {
      requestData.requested_by_user = userId;
    }

    const newRequest = await BloodRequest.create(requestData);
    console.log(`📌 Request created: ${newRequest._id} with status: ${finalStatus} (${isNormalFlow ? 'Normal' : 'Emergency'} flow)`);

    // STEP 4️⃣: TRIGGER GEOSPATIAL SEARCH (for both flows when status is IN_PROGRESS)
    // ================================================================================
    // This runs for:
    // - Normal flow: when inventory insufficient (finalStatus = IN_PROGRESS)
    // - Emergency flow: always (finalStatus = IN_PROGRESS by design)
    
    const shouldTriggerGeoSearch = finalStatus === 'IN_PROGRESS' && latitude && longitude;
    
    if (shouldTriggerGeoSearch) {
      console.log(`🔍 [Geospatial Search] Will trigger for ${isNormalFlow ? 'normal' : 'emergency'} flow`);
      // Async geospatial search - DON'T WAIT for this to complete
      (async () => {
        try {
          console.log(`🔍 [Geospatial Search] Initiated for ${blood_type} blood type`);

          // Get compatible blood types for this request
          const compatibleBloodTypes = getCompatibleBloodTypes(blood_type);
          console.log(`🩸 [Blood Compatibility] Request: ${blood_type} → Compatible donors: ${compatibleBloodTypes.join(', ')}`);

          // Find nearby donors with compatible blood types - OPTIMIZED QUERY
          console.log(`🔎 [Query] Searching within ${search_radius_km}km radius around [${latitude}, ${longitude}]`);
          
          const nearbyDonors = await Doner.find({
            blood_type: { $in: compatibleBloodTypes },  // ← Filter by compatible blood types!
            is_active: true,
            status: { $nin: ['banned', 'inactive'] },
            fcmToken: { $exists: true, $ne: null },
            // GeoJSON 2dsphere query
            current_location: {
              $near: {
                $geometry: {
                  type: 'Point',
                  coordinates: [parseFloat(longitude), parseFloat(latitude)]  // [long, lat]
                },
                $maxDistance: (search_radius_km || 10) * 1000  // Convert to meters
              }
            },
            // Ensure donor is eligible (not recently donated)
            last_donation_date: {
              $lt: new Date(Date.now() - 56 * 24 * 60 * 60 * 1000)  // Must be > 56 days ago
            }
          })
            .select('fcmToken name email mobile_number blood_type current_location donation_count')
            .sort({ current_location: 1 })  // Closest first
            .limit(500)  // Increased limit for better coverage
            .lean();

          console.log(`✅ [Geospatial Results] Found ${nearbyDonors.length} eligible donors`);
          
          if (nearbyDonors.length > 0) {
            const bloodTypeBreakdown = {};
            nearbyDonors.forEach(d => {
              bloodTypeBreakdown[d.blood_type] = (bloodTypeBreakdown[d.blood_type] || 0) + 1;
            });
            const breakdown = Object.entries(bloodTypeBreakdown)
              .map(([type, count]) => `${type}(${count})`)
              .join(', ');
            console.log(`   Breakdown: ${breakdown}`);
          }

          // Mark geosearch as triggered
          await BloodRequest.findByIdAndUpdate(newRequest._id, {
            geosearch_triggered: true,
            last_notification_sent: new Date()
          });

          // STEP 5️⃣: REAL-TIME NOTIFICATION - FCM PUSH NOTIFICATION
          // ===========================================================
          if (nearbyDonors.length > 0) {
            const fcmTokens = nearbyDonors
              .map(d => d.fcmToken)
              .filter(Boolean);

            // Remove duplicate tokens before sending
            const uniqueTokens = [...new Set(fcmTokens)];
            
            console.log(`📱 [FCM] Preparing to send to ${uniqueTokens.length} unique tokens...`);
            
            if (uniqueTokens.length > 0 && admin && admin.messaging) {
              try {
                // Check if messaging() is available and has sendMulticast
                const messaging = admin.messaging();
                if (!messaging || typeof messaging.sendMulticast !== 'function') {
                  console.warn('⚠️  [FCM] Firebase messaging not properly initialized - skipping');
                } else {
                  const message = {
                    notification: {
                      title: `🆘 URGENT: ${blood_type} Blood Needed!`,
                      body: `A request nearby urgently needs ${units_required} units of ${blood_type}. Help save lives!`
                    },
                    data: {
                      requestId: newRequest._id.toString(),
                      bloodType: blood_type,
                      urgencyLevel: urgency_level,
                      unitsNeeded: units_required.toString(),
                      distanceKm: search_radius_km.toString(),
                      deeplink: `/emergency/${newRequest._id}`
                    },
                    tokens: uniqueTokens
                  };

                  const fcmResponse = await messaging.sendMulticast(message);
                  const successCount = fcmResponse.successCount;
                  const failureCount = fcmResponse.failureCount;
                  
                  console.log(`✅ [FCM Results] SUCCESS: ${successCount} | FAILED: ${failureCount} | TOTAL: ${uniqueTokens.length}`);

                  // Log token errors for monitoring
                  if (failureCount > 0) {
                    const failedTokens = [];
                    fcmResponse.responses.forEach((resp, idx) => {
                      if (!resp.success) {
                        failedTokens.push(uniqueTokens[idx]);
                      }
                    });
                    console.warn(`⚠️  [FCM] ${failureCount} failed tokens to purge (use Firebase Admin Console)`);
                  }
                }
              } catch (fcmErr) {
                console.error('❌ [FCM] Error sending notifications:', fcmErr.message);
              }
            } else {
              if (!admin || !admin.messaging) {
                console.log('⚠️  [FCM] Firebase admin not initialized - skipping notifications');
              }
            }
          } else {
            console.log(`ℹ️  [FCM] No donors found - no notifications to send`);
          }
        } catch (geoErr) {
          console.error('❌ GeoJSON search error:', geoErr.message);
        }
      })().catch(err => {
        console.error('Async geosearch task error:', err);
      });
    } else if (finalStatus !== 'IN_PROGRESS') {
      console.log(`⏭️  [Geospatial Search] Skipped - status is ${finalStatus}, not IN_PROGRESS`);
    } else if (!latitude || !longitude) {
      console.log(`⏭️  [Geospatial Search] Skipped - coordinates not provided`);
    }

    // STEP 6️⃣: REAL-TIME NOTIFICATION - PUSHER (Admin Dashboard Alert)
    // ================================================================
    // Notify admin dashboard for BOTH normal and emergency flows
    (async () => {
      try {
        const PusherModule = await import('pusher');
        const Pusher = PusherModule.default || PusherModule;
        const pusher = new Pusher({
          appId: process.env.PUSHER_APP_ID,
          key: process.env.NEXT_PUBLIC_PUSHER_KEY,
          secret: process.env.PUSHER_SECRET,
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
          useTLS: true
        });

        console.log(`[Pusher] Sending ${isNormalFlow ? 'normal' : 'emergency'} request alert to admin dashboard...`);
        
        await pusher.trigger('blood-channel', 'new-alert', {
          requestId: newRequest._id.toString(),
          message: `🆘 New ${isNormalFlow ? 'normal' : 'emergency'} blood request: ${blood_type} (${units_required} units)`,
          blood_type,
          units_required,
          status: finalStatus,
          urgency_level,
          flow: isNormalFlow ? 'normal' : 'emergency',
          bloodbank_id: bloodbank_id || null,
          requester_role: user.role,
          created_at: new Date().toISOString()
        });

        console.log(`✅ Pusher notification sent for ${isNormalFlow ? 'normal' : 'emergency'} flow`);
      } catch (pusherErr) {
        console.error('❌ Pusher error (non-blocking):', pusherErr.message);
      }
    })().catch(err => {
      console.error('Async Pusher task error:', err);
    });

    // Response with metadata
    const processingTime = Date.now() - startTime;
    return NextResponse.json(
      {
        success: true,
        message: `${finalStatus === 'APPROVED' ? 'Blood request approved' : finalStatus === 'PARTIAL_APPROVED' ? 'Blood request partially approved' : 'Blood request created - searching for donors'}`,
        request: newRequest,
        metadata: {
          processing_time_ms: processingTime,
          flow: isNormalFlow ? 'normal' : 'emergency',
          inventory: {
            source: inventorySource,
            available_units: availableUnits,
            units_required: units_required,
            units_reserved: reservedUnits,
            status: finalStatus,
            error: reservationError
          }
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("❌ Blood request creation error:", error);
    return NextResponse.json(
      {
        error: "Failed to create blood request",
        details: error.message
      },
      { status: 500 }
    );
  }
}

// Get blood requests - with role-based filtering
export async function GET(req) {
  try {
    await connectDB();
    
    // ====== AUTHENTICATION ======
    const token = await getAuthToken(req);
    if (!token) {
      console.error(`❌ [/api/requests GET] Authentication failed: No token found`);
      return NextResponse.json({ error: "Unauthorized - Please login or provide Bearer token" }, { status: 401 });
    }

    const userId = token.userId || token.sub;
    const user = await User.findById(userId);
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log(`✅ [/api/requests GET] User authenticated: ${userId} (${user.role})`);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const request_type = searchParams.get("request_type");
    
    let query = {};
    
    // Role-based filtering
    if (user.role === 'user') {
      // Users can see their own requests (including emergency requests)
      query.$or = [
        { requested_by_user: userId },
        { emergency_requester_email: user.email } // For emergency requests made before login
      ];
    } else if (user.role === 'bloodbank_admin') {
      // Blood banks can see requests to their banks
      // Try both: BloodBank._id and direct comparison with userId
      const bloodBank = await BloodBank.findOne({ user_id: userId });
      if (bloodBank) {
        // Filter by BloodBank ID (case bloodbank_id stores BloodBank._id)
        query.$or = [
          { bloodbank_id: bloodBank._id },
          { bloodbank_id: userId } // Fallback: if bloodbank_id is stored as User ID
        ];
        console.log('🔍 BloodBank filtering - User ID:', userId, 'BloodBank ID:', bloodBank._id);
      } else {
        console.warn('⚠️ No BloodBank found for user:', userId);
        return NextResponse.json({ requests: [] }, { status: 200 });
      }
    } else if (user.role === 'hospital') {
      // Hospitals can see all requests or filter by their requests
      query.requested_by_hospital = userId;
    }
    
    // Apply additional filters
    if (status) query.status = status;
    if (request_type) query.request_type = request_type;
    
    const requests = await BloodRequest.find(query)
      .populate('requested_by_user', 'name email mobile_number')
      .populate('requested_by_hospital', 'name email mobile_number')
      .populate('bloodbank_id', 'name address contact_number email')
      .sort({ requested_date: -1 });

    console.log(`✅ Fetched ${requests.length} requests for user ${userId}`);
    
    return NextResponse.json({ requests }, { status: 200 });
  } catch (error) {
    console.error("❌ Error fetching blood requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch blood requests" },
      { status: 500 }
    );
  }
}

// Update request status - only by bloodbank admin
export async function PUT(req) {
  try {
    await connectDB();
    
    // ====== AUTHENTICATION ======
    const token = await getAuthToken(req);
    if (!token) {
      console.error(`❌ [/api/requests PUT] Authentication failed: No token found`);
      return NextResponse.json({ error: "Unauthorized - Please login or provide Bearer token" }, { status: 401 });
    }

    const userId = token.userId || token.sub;
    const body = await req.json();
    const { request_id, status, fulfilled_date, rejection_reason } = body;
    
    if (!request_id || !status) {
      return NextResponse.json(
        { error: "Request ID and status are required" },
        { status: 400 }
      );
    }

    // Verify status is valid
    if (!["accepted", "rejected", "pending"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'pending', 'accepted', or 'rejected'" },
        { status: 400 }
      );
    }

    // If rejecting, rejection reason is mandatory
    if (status === "rejected" && !rejection_reason) {
      return NextResponse.json(
        { error: "Rejection reason is required when rejecting a request" },
        { status: 400 }
      );
    }

    // Verify user exists and is a blood bank admin
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (user.role !== "bloodbank_admin") {
      return NextResponse.json(
        { error: "Only blood bank administrators can update request status" },
        { status: 403 }
      );
    }
    
    // Find the request
    const request = await BloodRequest.findById(request_id);
    if (!request) {
      return NextResponse.json(
        { error: "Blood request not found" },
        { status: 404 }
      );
    }
    
    // Verify the admin manages this blood bank
    const bloodBank = await BloodBank.findOne({
      _id: request.bloodbank_id,
      user_id: userId
    });

    if (!bloodBank) {
      return NextResponse.json(
        { error: "Not authorized to update status for this blood bank's requests" },
        { status: 403 }
      );
    }

    // If accepting the request, check inventory and update
    if (status === "accepted") {
      // Find the relevant inventory
      const inventory = await BloodInventory.findOne({
        bloodbank_id: request.bloodbank_id,
        blood_type: request.blood_type
      });

      // Check if there's enough blood available
      if (!inventory || inventory.units_available < request.units_required) {
        return NextResponse.json(
          { error: "Not enough blood units available to fulfill this request" },
          { status: 400 }
        );
      }

      // Update inventory
      await BloodInventory.findByIdAndUpdate(
        inventory._id,
        { units_available: inventory.units_available - request.units_required }
      );
    }
    
    // Update request status
    const updateData = { 
      status,
      fulfilled_date: status === "accepted" ? (fulfilled_date || new Date()) : null,
      rejection_reason: status === "rejected" ? rejection_reason : null
    };
    
    const updatedRequest = await BloodRequest.findByIdAndUpdate(
      request_id,
      updateData,
      { new: true }
    );
    
    return NextResponse.json(
      { 
        message: `Blood request ${status}`, 
        request: updatedRequest 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Blood request update error:", error);
    return NextResponse.json(
      { error: "Failed to update blood request" },
      { status: 500 }
    );
  }
}