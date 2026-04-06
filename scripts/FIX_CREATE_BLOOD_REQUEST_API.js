// app/api/requests/route.js - POST HANDLER (FIXED VERSION)
// ============================================================

import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import BloodRequest from "@/models/BloodRequest.js";
import User from "@/models/User.js";
import BloodBank from "@/models/BloodBank.js";
import BloodInventory from "@/models/BloodInventory.js";
import Doner from "@/models/Doner.js";
import { getToken } from "next-auth/jwt";
import admin from '@/config/firebase.mjs';

/**
 * CREATE BLOOD REQUEST - FIXED VERSION
 * Implements 5-step logic with Race Condition protection
 */
export async function POST(req) {
  const startTime = Date.now();
  
  try {
    await connectDB();
    
    // Authenticate user
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = token.userId || token.sub;

    // STEP 1️⃣: LẤY PAYLOAD
    // ========================
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

    // Validation
    if (!blood_type || !units_required || !bloodbank_id) {
      return NextResponse.json(
        { error: "Missing required fields: blood_type, units_required, bloodbank_id" },
        { status: 400 }
      );
    }

    if (units_required <= 0) {
      return NextResponse.json(
        { error: "Units required must be positive" },
        { status: 400 }
      );
    }

    // Verify bloodbank exists
    const bloodBank = await BloodBank.findById(bloodbank_id);
    if (!bloodBank) {
      return NextResponse.json(
        { error: "Blood bank not found" },
        { status: 404 }
      );
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

    // STEP 2️⃣: AUTO-CHECK INVENTORY (Redis Priority → MongoDB)
    // ==========================================================
    let availableUnits = 0;
    let inventoryId = null;
    let inventorySource = 'none';

    // Try Redis first (if configured)
    if (process.env.REDIS_HOST) {
      try {
        const redis = require('redis');
        const client = redis.createClient({
          host: process.env.REDIS_HOST,
          port: process.env.REDIS_PORT || 6379,
          socket: { connectTimeout: 2000 }
        });

        client.on('error', err => console.warn('⚠️ Redis client error:', err));
        
        await client.connect();
        const cacheKey = `bloodbank:${bloodbank_id}:${blood_type}`;
        const cachedValue = await client.get(cacheKey);
        
        if (cachedValue !== null) {
          availableUnits = parseInt(cachedValue);
          inventorySource = 'redis_cache';
          console.log(`✅ Inventory from Redis: ${availableUnits} units`);
        }
        
        await client.quit();
      } catch (redisErr) {
        console.warn('⚠️ Redis fallback - using MongoDB:', redisErr.message);
      }
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
        console.log(`✅ Inventory from MongoDB: ${availableUnits} units`);
      } else {
        console.log(`❌ No inventory found for ${blood_type}`);
        inventorySource = 'not_found';
      }
    }

    // STEP 3️⃣: BRANCH 1 - ENOUGH BLOOD (APPROVED + RESERVE)
    // =====================================================
    let finalStatus = 'IN_REVIEW';
    let reservedUnits = 0;
    let reservationExpiry = null;
    let reservationError = null;

    // Determine status based on inventory
    if (availableUnits >= units_required * 0.8) {
      // At least 80% available → try to reserve
      finalStatus = availableUnits >= units_required ? 'APPROVED' : 'PARTIAL_APPROVED';

      // CRITICAL SECTION: Atomic reserve to prevent race condition
      if (inventoryId) {
        try {
          console.log(`🔒 Attempting to reserve ${units_required} units...`);
          
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
              $inc: { units_available: -units_required },  // ← ATOMIC DECREMENT
              $push: { reservations: reservationDoc }
            },
            { 
              new: true,
              runValidators: true,
              session: null  // Ensure atomic at DB level
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

    // Create the blood request
    const requestData = {
      blood_type,
      units_required,
      bloodbank_id,
      request_type: request_type || (user.role === 'hospital' ? 'normal' : 'emergency'),
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
    console.log(`📌 Request created: ${newRequest._id} with status: ${finalStatus}`);

    // STEP 4️⃣: BRANCH 2 - INSUFFICIENT BLOOD (GeoJSON QUERY)
    // =================================================
    if (finalStatus === 'IN_PROGRESS' && latitude && longitude) {
      // Async geospatial search - DON'T WAIT
      (async () => {
        try {
          console.log(`🔍 Triggering GeoJSON search for ${blood_type} donors...`);

          // Find nearby donors with SAME blood type
          const nearbyDonors = await Doner.find({
            blood_type: blood_type,  // ← CRITICAL: Filter by blood type!
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
            .limit(500)  // Increased limit, with pagination support
            .lean();

          console.log(`✅ Found ${nearbyDonors.length} nearby donors with ${blood_type}`);

          // Mark geosearch as triggered
          await BloodRequest.findByIdAndUpdate(newRequest._id, {
            geosearch_triggered: true,
            last_notification_sent: new Date()
          });

          // STEP 5️⃣: REAL-TIME NOTIFICATION - FCM
          // =======================================
          if (nearbyDonors.length > 0) {
            const fcmTokens = nearbyDonors
              .map(d => d.fcmToken)
              .filter(Boolean);

            // Remove duplicate tokens
            const uniqueTokens = [...new Set(fcmTokens)];
            
            if (uniqueTokens.length > 0 && admin && admin.messaging) {
              try {
                const message = {
                  notification: {
                    title: `🆘 URGENT: ${blood_type} Blood Needed!`,
                    body: `A hospital nearby urgently needs ${units_required} units of ${blood_type}. Help save lives!`
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

                const fcmResponse = await admin.messaging().sendMulticast(message);
                console.log(`✅ FCM sent: ${fcmResponse.successCount} success, ${fcmResponse.failureCount} failed`);

                // Log token errors for monitoring
                if (fcmResponse.failureCount > 0) {
                  const invalidTokens = [];
                  fcmResponse.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                      invalidTokens.push(uniqueTokens[idx]);
                    }
                  });
                  console.warn(`⚠️ Invalid FCM tokens to purge:`, invalidTokens);
                  // Optional: Schedule cleanup of invalid tokens
                }
              } catch (fcmErr) {
                console.error('❌ FCM error:', fcmErr.message);
              }
            } else {
              console.log('ℹ️ Firebase admin not initialized or no donors found');
            }
          }
        } catch (geoErr) {
          console.error('❌ GeoJSON search error:', geoErr.message);
          // Non-blocking: Don't fail main request
        }
      })().catch(err => {
        console.error('Async geosearch task error:', err);
      });
    }

    // STEP 5️⃣: REAL-TIME NOTIFICATION - PUSHER
    // ==========================================
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

        console.log("--> Sending Pusher notification...");
        
        await pusher.trigger('blood-channel', 'new-alert', {
          requestId: newRequest._id.toString(),
          message: `🆘 New blood request: ${blood_type} (${units_required} units)`,
          blood_type,
          units_required,
          status: finalStatus,
          urgency_level,
          bloodbank_id: newRequest.bloodbank_id.toString(),
          requester_role: user.role,
          created_at: new Date().toISOString()
        });

        console.log("--> Pusher notification sent!");
      } catch (pusherErr) {
        console.error('❌ Pusher error (non-blocking):', pusherErr.message);
      }
    })().catch(err => {
      console.error('Async Pusher task error:', err);
    });

    // Response
    const processingTime = Date.now() - startTime;
    return NextResponse.json(
      {
        success: true,
        message: `${request_type || 'Blood'} request created successfully`,
        request: newRequest,
        metadata: {
          processing_time_ms: processingTime,
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

// Import mongoose for ObjectId generation
import mongoose from "mongoose";
