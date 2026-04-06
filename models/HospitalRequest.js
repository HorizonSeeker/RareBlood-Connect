import mongoose from 'mongoose';

const hospitalRequestSchema = new mongoose.Schema({
  hospital_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bloodbank_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  request_type: {
    type: String,
    enum: ['patient', 'inventory'],
    required: true
  },
  blood_type: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: true
  },
  units_requested: {
    type: Number,
    required: true,
    min: 1
  },
  urgency_level: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  is_emergency: {
    type: Boolean,
    default: false
  },
  compatible_blood_types: [{
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  }],
  patient_details: {
    name: String,
    age: Number,
    condition: String
  },
  reason: {
    type: String,
    required: true
  },
  search_radius: {
    type: Number,
    default: 10, // kilometers
    min: 1,
    max: 100
  },
  hospital_location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  available_bloodbanks: [{
    bloodbank_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    distance: Number,
    available_units: Number,
    has_blood_type: Boolean
  }],
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'fulfilled', 'cancelled', 'auto_routing'],
    default: 'pending'
  },
  response_message: {
    type: String
  },
  responded_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  responded_at: {
    type: Date
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  emergency_notification: {
    status: {
      type: String,
      enum: ['pending', 'triggered', 'acknowledged', 'resolved'],
      default: 'pending'
    },
    sent_count: {
      type: Number,
      default: 0
    },
    sent_at: {
      type: Date
    }
  },
  responders: [{
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    respondedAt: {
      type: Date,
      default: Date.now
    }
  }],
  delivery_info: {
    estimated_minutes: {
      type: Number,
      min: 1,
      max: 1440 // max 24 hours
    },
    driver_name: {
      type: String,
      trim: true
    },
    driver_phone: {
      type: String,
      trim: true
    },
    confirmed_at: {
      type: Date
    }
  },
  forwarded_to: [{
    bloodbank_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    forwarded_at: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    reason: String
  }],
  // 📍 USER LOCATION FIELDS - CRITICAL FOR AUTO-ROUTING
  user_latitude: {
    type: Number,
    default: null
  },
  user_longitude: {
    type: Number,
    default: null
  },
  location_accuracy: {
    type: Number,
    default: null
  },
  location_source: {
    type: String,
    enum: ['auto', 'manual', 'denied', 'fallback'],
    default: 'fallback'
  },
  sos_broadcasted: {
    triggered: {
      type: Boolean,
      default: false
    },
    broadcasted_at: {
      type: Date,
      default: null
    },
    total_donors_found: {
      type: Number,
      default: 0,
      description: 'Total donors matching blood type within search radius'
    },
    donors_fcm_sent: {
      type: Number,
      default: 0,
      description: 'FCM notifications successfully sent'
    },
    database_records_created: {
      type: Number,
      default: 0,
      description: 'DonorContactRequest records created in database'
    },
    failures_count: {
      type: Number,
      default: 0,
      description: 'Number of donors who failed to receive notification'
    },
    // Deprecated: Use database_records_created instead
    donors_notified: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Update the updated_at field before saving
hospitalRequestSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Create indexes for better query performance
hospitalRequestSchema.index({ hospital_id: 1, status: 1 });
hospitalRequestSchema.index({ bloodbank_id: 1, status: 1 });
hospitalRequestSchema.index({ created_at: -1 });
// 📍 Geospatial index for location-based queries
hospitalRequestSchema.index({ user_latitude: 1, user_longitude: 1 });
hospitalRequestSchema.index({ status: 1, is_emergency: 1 });

const HospitalRequest = mongoose.models.HospitalRequest || mongoose.model('HospitalRequest', hospitalRequestSchema);

export default HospitalRequest;
