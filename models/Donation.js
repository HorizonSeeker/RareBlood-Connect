import mongoose from "mongoose";

const donationSchema = new mongoose.Schema({
  donor_id: { type: mongoose.Schema.Types.ObjectId, ref: "Donor", required: true },
  bloodbank_id: { type: String, default: null },
  blood_type: { type: String, required: true },
  units_collected: { type: Number, default: 1 },
  units_donated: { type: Number, default: 1 },
  status: {
    type: String,
    enum: ['pending', 'completed', 'no-show', 'cancelled'],
    default: 'completed'
  },
  donation_date: { type: Date, default: Date.now },
  notes: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.models.Donation || mongoose.model("Donation", donationSchema);
