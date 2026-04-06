import mongoose from "mongoose";

const donationAppointmentSchema = new mongoose.Schema({
  donor_id: { type: mongoose.Schema.Types.ObjectId, ref: "Donor", required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  bloodbank_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  appointment_date: { type: Date, required: true },
  appointment_time: { type: String, required: true }, // Format: "HH:MM"
  status: {
    type: String,
    enum: ['pending', 'approved', 'completed', 'cancelled'],
    default: 'pending'
  },
  cancellation_reason: { type: String, default: null },
  notes: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Index for queries by donor_id and status
donationAppointmentSchema.index({ donor_id: 1, status: 1 });
donationAppointmentSchema.index({ bloodbank_id: 1, status: 1 });

export default mongoose.models.DonationAppointment || mongoose.model("DonationAppointment", donationAppointmentSchema);
