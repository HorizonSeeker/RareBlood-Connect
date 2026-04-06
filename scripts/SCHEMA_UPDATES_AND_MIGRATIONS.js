// SCHEMA UPDATES & INDEXES
// ========================

// 1. BloodInventory Schema - THÊM reservation tracking
// ======================================================
/*
import mongoose from "mongoose";

const bloodInventorySchema = new mongoose.Schema({
  bloodbank_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "BloodBank", 
    required: true 
  },
  blood_type: { 
    type: String, 
    required: true 
  },
  units_available: { 
    type: Number, 
    required: true,
    min: 0
  },
  
  // ✅ THÊM: Reservation tracking để prevent race condition
  reservations: [{
    request_id: mongoose.Schema.Types.ObjectId,
    units: { type: Number, required: true },
    reserved_at: { type: Date, default: Date.now },
    expires_at: { type: Date, required: true },
    fulfilled_at: { type: Date, default: null }
  }],
  
  date_of_entry: { 
    type: Date, 
    default: Date.now 
  },
  expiry_date: { 
    type: Date, 
    required: true,
    index: true
  },
  
  last_updated: {
    type: Date,
    default: Date.now
  }
});

// ✅ CRITICAL INDEX: For main inventory queries
bloodInventorySchema.index({ 
  bloodbank_id: 1, 
  blood_type: 1, 
  expiry_date: 1 
});

// ✅ Index for cleanup jobs
bloodInventorySchema.index({ 
  expiry_date: 1 
}, { 
  expireAfterSeconds: 86400 
});

// Migration query to update existing collections:
// db.bloodinventories.updateMany({}, { $set: { reservations: [] } })

export default mongoose.models.BloodInventory || 
  mongoose.model("BloodInventory", bloodInventorySchema);
*/

// 2. BloodRequest Schema - THÊM tracking fields
// ==============================================
/*
import mongoose from "mongoose";

const bloodRequestSchema = new mongoose.Schema({
  requested_by_user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    default: null 
  },
  requested_by_hospital: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    default: null 
  },
  bloodbank_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "BloodBank", 
    required: true 
  },
  blood_type: { 
    type: String, 
    required: true 
  },
  units_required: { 
    type: Number, 
    required: true,
    min: 1
  },
  request_type: { 
    type: String, 
    enum: ["normal", "emergency"], 
    default: "emergency" 
  },
  
  // ✅ THÊM: Enhanced status field
  status: { 
    type: String, 
    enum: ["IN_REVIEW", "APPROVED", "PARTIAL_APPROVED", "IN_PROGRESS", "FULFILLED", "REJECTED", "CANCELLED"], 
    default: "IN_REVIEW",
    index: true
  },
  
  // ✅ THÊM: Urgency level
  urgency_level: {
    type: String,
    enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    default: "MEDIUM"
  },
  
  // ✅ THÊM: Inventory reservation tracking
  inventory_reserved: {
    units: { type: Number, default: 0 },
    inventory_id: mongoose.Schema.Types.ObjectId,
    reserved_at: { type: Date, default: null },
    expired_at: { type: Date, default: null }
  },
  
  // ✅ THÊM: GeoSearch tracking
  user_latitude: { type: Number, default: null },
  user_longitude: { type: Number, default: null },
  search_radius_km: { type: Number, default: 10 },
  geosearch_triggered: { type: Boolean, default: false },
  last_notification_sent: { type: Date, default: null },
  
  requested_date: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  fulfilled_date: { 
    type: Date, 
    default: null 
  },
  rejection_reason: { 
    type: String, 
    default: null 
  },
  
  emergency_contact_name: { 
    type: String, 
    default: null 
  },
  emergency_contact_mobile: { 
    type: String, 
    default: null 
  },
  emergency_details: { 
    type: String, 
    default: null 
  },
  hospital_location: { 
    type: String, 
    default: null 
  },
  
  emergency_requester_name: { 
    type: String, 
    default: null 
  },
  emergency_requester_email: { 
    type: String, 
    default: null 
  },
  relation_to_patient: { 
    type: String, 
    default: null 
  }
});

// ✅ Indexes for performance
bloodRequestSchema.index({ requested_by_hospital: 1, status: 1 });
bloodRequestSchema.index({ bloodbank_id: 1, status: 1 });
bloodRequestSchema.index({ blood_type: 1, status: 1 });
bloodRequestSchema.index({ requested_date: -1 });

// Migration query:
// db.bloodrequests.updateMany({}, { 
//   $set: { 
//     status: "IN_REVIEW",
//     urgency_level: "MEDIUM",
//     geosearch_triggered: false
//   } 
// })

export default mongoose.models.BloodRequest || 
  mongoose.model("BloodRequest", bloodRequestSchema);
*/

// 3. Doner Schema - GeoJSON Index BẮTBUỘC
// ========================================
/*
import mongoose from "mongoose";

const donerSchema = new mongoose.Schema({
  // ... existing fields ...
  
  blood_type: { 
    type: String, 
    required: true,
    index: true
  },
  
  current_location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],  // [longitude, latitude] - GeoJSON standard
      required: false,
      sparse: true
    }
  },
  
  is_active: { 
    type: Boolean, 
    default: true,
    index: true
  },
  
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned', 'on_cooldown'],
    default: 'active'
  },
  
  fcmToken: { 
    type: String,
    index: true,
    sparse: true
  },
  
  last_donation_date: { 
    type: Date,
    default: null
  },
  
  donation_count: {
    type: Number,
    default: 0
  }
});

// ✅ GeoJSON 2dsphere Index (ESSENTIAL!)
donerSchema.index({ current_location: '2dsphere' });

// ✅ Compound Index for optimized geo queries
donerSchema.index({ 
  blood_type: 1, 
  current_location: '2dsphere', 
  is_active: 1,
  fcmToken: 1
});

// ✅ For token management
donerSchema.index({ fcmToken: 1 });

// Migration query to create indexes:
// db.doners.createIndex({ current_location: "2dsphere" })
// db.doners.createIndex({ blood_type: 1, current_location: "2dsphere", is_active: 1, fcmToken: 1 })

export default mongoose.models.Doner || 
  mongoose.model("Doner", donerSchema);
*/

// SETUP & MIGRATION SCRIPT
// ========================
/*
// 1. Run this in MongoDB shell or MongoDB Atlas:

// Create/Update Indexes
db.bloodinventories.createIndex({ bloodbank_id: 1, blood_type: 1, expiry_date: 1 });
db.bloodinventories.createIndex({ expiry_date: 1 });

db.bloodrequests.createIndex({ requested_by_hospital: 1, status: 1 });
db.bloodrequests.createIndex({ bloodbank_id: 1, status: 1 });
db.bloodrequests.createIndex({ blood_type: 1, status: 1 });
db.bloodrequests.createIndex({ requested_date: -1 });

// ⭐ CRITICAL: GeoJSON Index
db.doners.createIndex({ current_location: "2dsphere" });
db.doners.createIndex({ blood_type: 1, current_location: "2dsphere", is_active: 1, fcmToken: 1 });
db.doners.createIndex({ fcmToken: 1 });

// 2. Update existing documents
db.bloodinventories.updateMany(
  { reservations: { $exists: false } },
  { $set: { reservations: [] } }
);

db.bloodrequests.updateMany(
  { status: "pending" },
  { $set: { 
    status: "IN_REVIEW",
    urgency_level: "MEDIUM",
    geosearch_triggered: false
  }}
);

// 3. Verify indexes
db.doners.getIndexes();
db.bloodinventories.getIndexes();
db.bloodrequests.getIndexes();
*/

// RESERVATION CLEANUP JOB
// =====================
/*
// File: scripts/cleanup-expired-reservations.js

import connectDB from "@/db/connectDB.mjs";
import BloodInventory from "@/models/BloodInventory.js";
import BloodRequest from "@/models/BloodRequest.js";

export async function cleanupExpiredReservations() {
  try {
    await connectDB();
    
    const now = new Date();
    
    // Find all reservations that have expired
    const expiredResults = await BloodInventory.updateMany(
      {
        'reservations.expires_at': { $lt: now },
        'reservations.fulfilled_at': null  // Only expired, not fulfilled
      },
      {
        $pull: {  // Remove expired reservations
          reservations: {
            expires_at: { $lt: now },
            fulfilled_at: null
          }
        },
        $inc: {  // Restore units
          units_available: {
            // Calculate sum of expired units
            $sum: "$reservations.units"  // This is a simplified approach
          }
        }
      }
    );

    console.log(`✅ Cleanup: ${expiredResults.modifiedCount} inventory records updated`);
    
    // Mark corresponding requests as REJECTED or CANCELLED
    const rejectedResults = await BloodRequest.updateMany(
      {
        status: 'IN_PROGRESS',
        'inventory_reserved.expired_at': { $lt: now }
      },
      {
        $set: {
          status: 'CANCELLED',
          rejection_reason: 'Reservation expired - timeout'
        }
      }
    );

    console.log(`✅ Cleanup: ${rejectedResults.modifiedCount} requests marked as CANCELLED`);
    
  } catch (err) {
    console.error('❌ Cleanup job error:', err);
  }
}

// Schedule this to run every 1 hour using node-cron:
// import cron from 'node-cron';
// cron.schedule('0 * * * *', cleanupExpiredReservations);
*/

export { };
