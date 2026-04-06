import mongoose from 'mongoose';

const donorContactRequestSchema = new mongoose.Schema({
  // 🔗 CRITICAL: Link back to HospitalRequest (for auto-routing)
  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HospitalRequest',
    default: null,
    index: true
  },
  requesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  donorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Donor', // Changed from 'Doner' to 'Donor'
    required: true
  },
  // Hospital reference (the one requesting blood)
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Blood bank that rejected (for emergency auto-routing)
  bloodbankId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  bloodType: {
    type: String,
    required: true
  },
  urgencyLevel: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  message: {
    type: String,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired', 'completed', 'no-show'],
    default: 'pending'
  },
  requestDate: {
    type: Date,
    default: Date.now
  },
  responseDate: {
    type: Date
  },
  acceptedAt: {
    type: Date
  },
  rejectedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  noShowAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
  },
  // Request type: CONTACT (blood bank contact) or EMERGENCY (auto-routed)
  requestType: {
    type: String,
    enum: ['CONTACT', 'EMERGENCY'],
    default: 'CONTACT'
  },
  // Source of the request
  sourceType: {
    type: String,
    enum: ['blood_bank', 'emergency_broadcast', 'donor_search'],
    default: 'blood_bank'
  }
}, {
  timestamps: true
});

// Index for efficient queries
donorContactRequestSchema.index({ requestId: 1 });
donorContactRequestSchema.index({ donorId: 1, status: 1 });
donorContactRequestSchema.index({ donorId: 1, requestId: 1 });
donorContactRequestSchema.index({ requesterId: 1, status: 1 });
donorContactRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const DonorContactRequest = mongoose.models.DonorContactRequest || 
  mongoose.model('DonorContactRequest', donorContactRequestSchema);

export default DonorContactRequest;