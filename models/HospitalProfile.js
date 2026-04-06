import mongoose from "mongoose";

const hospitalProfileSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  contact_number: { type: String, required: true },
  hospital_license_url: { type: String, default: null }, // License certificate uploaded during registration

  // Verification fields (SOP12)
  verification_status: { type: String, enum: ['not_requested','pending','verified','rejected'], default: 'not_requested' },
  verification_documents: [{ name: String, url: String }],
  verification_requested_at: { type: Date },
  verified_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  verified_at: { type: Date },
  verification_notes: { type: String, default: '' }
});

// ✅ FIX: Add geospatial index for location-based queries
// This index is critical for efficient distance calculations and geospatial queries
hospitalProfileSchema.index({
  location: '2dsphere'
});

// Also add single field indexes for common queries
hospitalProfileSchema.index({ user_id: 1 });
hospitalProfileSchema.index({ name: 1 });
hospitalProfileSchema.index({ verification_status: 1 });

export default mongoose.models.HospitalProfile || mongoose.model("HospitalProfile", hospitalProfileSchema);
