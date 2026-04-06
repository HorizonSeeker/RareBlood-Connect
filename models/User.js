import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // hashed
  // Contact information (for bloodbanks and users)
  phone: { type: String, default: '' },
  mobile_number: { type: String, default: '' }, // Primary mobile for donors
  emergency_contact_mobile: { type: String, default: '' }, // Emergency contact mobile
  address: { type: String, default: '' },
  // 📍 GeoJSON Location for blood banks (for geospatial queries)
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    },
    address: String
  },
  // 🩸 Donor-specific fields
  dateOfBirth: { type: Date, default: null }, // Date of birth to verify age (must be 18+)
  gender: { type: String, enum: ['Male', 'Female', 'Other'], default: null }, // Gender
  weight: { type: Number, default: null }, // Weight in kg
  bloodType: { type: String, default: null }, // Blood type for donors (A+, A-, B+, etc.)
  current_location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  // FCM token for push notifications (optional)
  fcmToken: { type: String, default: null },
  role: { type: String, enum: ["user", "hospital", "bloodbank_admin", "admin"], default: null }, // Not required initially, set during role selection
  isRegistrationComplete: { type: Boolean, default: false }, // Tracks if user has completed role-specific registration
  verification_status: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING' }, // Verification status for donors
  lastLoginDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// 🗺️ Create geospatial index for location queries (2dsphere for spherical distance)
userSchema.index({ location: '2dsphere' });
userSchema.index({ current_location: '2dsphere' }); // Index for donor location

export default mongoose.models.User || mongoose.model("User", userSchema);
