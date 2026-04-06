import mongoose from "mongoose";

const bloodRequestSchema = new mongoose.Schema({
  requested_by_user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  requested_by_hospital: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  bloodbank_id: { type: mongoose.Schema.Types.ObjectId, ref: "BloodBank", default: null },  // Optional for emergency flow
  blood_type: { type: String, required: true },
  units_required: { type: Number, required: true },
  request_type: { type: String, enum: ["normal", "emergency"], default: "emergency" },
  
  // UPDATED: Enhanced status with new values for 5-step logic
  status: { 
    type: String, 
    enum: ["IN_REVIEW", "APPROVED", "PARTIAL_APPROVED", "IN_PROGRESS", "FULFILLED", "REJECTED", "CANCELLED"], 
    default: "IN_REVIEW",
    index: true
  },
  
  // NEW: Urgency level
  urgency_level: {
    type: String,
    enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    default: "MEDIUM"
  },
  
  // NEW: Inventory reservation tracking
  inventory_reserved: {
    units: { type: Number, default: 0 },
    inventory_id: mongoose.Schema.Types.ObjectId,
    reserved_at: { type: Date, default: null },
    expired_at: { type: Date, default: null }
  },
  
  // NEW: GeoSearch tracking fields
  user_latitude: { type: Number, default: null },
  user_longitude: { type: Number, default: null },
  search_radius_km: { type: Number, default: 10 },
  geosearch_triggered: { type: Boolean, default: false },
  last_notification_sent: { type: Date, default: null },
  
  requested_date: { type: Date, default: Date.now, index: true },
  fulfilled_date: { type: Date, default: null },
  rejection_reason: { type: String, default: null },
  
  emergency_contact_name: { type: String, default: null },
  emergency_contact_mobile: { type: String, default: null },
  emergency_details: { type: String, default: null },
  hospital_location: { type: String, default: null },
  
  emergency_requester_name: { type: String, default: null },
  emergency_requester_email: { type: String, default: null },
  relation_to_patient: { type: String, default: null }
});

// Add indexes for performance
bloodRequestSchema.index({ requested_by_hospital: 1, status: 1 });
bloodRequestSchema.index({ bloodbank_id: 1, status: 1 });
bloodRequestSchema.index({ blood_type: 1, status: 1 });
bloodRequestSchema.index({ requested_date: -1 });

export default mongoose.models.BloodRequest || mongoose.model("BloodRequest", bloodRequestSchema);
    