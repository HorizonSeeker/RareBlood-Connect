import mongoose from "mongoose";

const donorSchema = new mongoose.Schema({
  donor_id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  dateOfBirth: { type: Date, required: true }, // Date of birth for age verification
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true }, // Gender
  age: { type: Number, required: true },
  blood_type: { type: String, required: true, index: true },
  mobile_number: { type: String, required: true },
  weight: { type: Number, required: true },
  emergency_contact_mobile: { type: String, required: true },
  address: { type: String, required: true },
  medicalProofUrl: { type: String, required: true },
  verification_status: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING' },
  total_donations: { type: Number, default: 0 },
  donation_count: { type: Number, default: 0 },
  
  // Critical Service Fields
  is_critical_ready: { type: Boolean, default: false },
  
  // NEW: Active status for query filtering
  is_active: { type: Boolean, default: true, index: true },
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned', 'on_cooldown'],
    default: 'active'
  },
  
  // GeoJSON Location - CRITICAL for spatial queries
  current_location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
  },
  
  // FCM token for push notifications
  fcmToken: { type: String, default: null, index: true, sparse: true },
  
  // NEW: Last donation date for eligibility check (56-day rule)
  last_donation_date: { type: Date, default: null },
  
  // Request Response Tracking
  accepted_requests: { type: Number, default: 0 },
  recent_activity: [{
    type: { type: String },
    description: { type: String },
    date: { type: Date, default: Date.now },
    details: { type: mongoose.Schema.Types.Mixed }
  }],
  
  created_at: { type: Date, default: Date.now }
});

// CRITICAL: GeoJSON 2dsphere index for location queries
donorSchema.index({ current_location: '2dsphere' });

// NEW: Compound index for optimized geospatial + blood_type queries
donorSchema.index({ 
  blood_type: 1, 
  current_location: '2dsphere', 
  is_active: 1
});

// Note: fcmToken index is already defined in field definition with "index: true, sparse: true"
// Removed duplicate index declaration to prevent MongoDB warnings

export default mongoose.models.Donor || mongoose.model("Donor", donorSchema);
