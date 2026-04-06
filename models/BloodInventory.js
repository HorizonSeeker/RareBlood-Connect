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
  
  // NEW: Reservation tracking for race condition prevention
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

// Indexes for performance
bloodInventorySchema.index({ 
  bloodbank_id: 1, 
  blood_type: 1, 
  expiry_date: 1 
});

export default mongoose.models.BloodInventory || mongoose.model("BloodInventory", bloodInventorySchema);
