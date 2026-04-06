import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: ['donation_appointment_approved', 'donation_appointment_declined', 'emergency_request', 'general'],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  related_entity_id: { type: mongoose.Schema.Types.ObjectId, default: null }, // e.g., DonationAppointment ID
  related_entity_type: { type: String, default: null }, // e.g., 'DonationAppointment'
  is_read: { type: Boolean, default: false },
  action_url: { type: String, default: null }, // URL to related page
  created_at: { type: Date, default: Date.now },
  expires_at: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } // 30 days
});

// Index for efficient queries
notificationSchema.index({ recipient_id: 1, is_read: 1, created_at: -1 });
notificationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion

export default mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
