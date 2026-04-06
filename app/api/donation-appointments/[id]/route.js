import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import DonationAppointment from "@/models/DonationAppointment.js";
import Notification from "@/models/Notification.js";
import User from "@/models/User.js";
import { requireAuth } from "@/lib/authMiddleware";
import mongoose from "mongoose";

// Helper function to send notification
async function sendNotificationToDonor(donorUserId, appointmentData, status) {
  try {
    let notificationData = {};

    if (status === 'approved') {
      notificationData = {
        recipient_id: donorUserId,
        type: 'donation_appointment_approved',
        title: '✅ Appointment Approved!',
        message: `Your donation appointment on ${new Date(appointmentData.appointment_date).toLocaleDateString()} at ${appointmentData.appointment_time} has been approved. Please arrive on time.`,
        related_entity_id: appointmentData._id,
        related_entity_type: 'DonationAppointment',
        action_url: '/dashboard/donor'
      };
    } else if (status === 'cancelled') {
      notificationData = {
        recipient_id: donorUserId,
        type: 'donation_appointment_declined',
        title: '❌ Appointment Declined',
        message: `Your donation appointment on ${new Date(appointmentData.appointment_date).toLocaleDateString()} at ${appointmentData.appointment_time} has been declined. Reason: ${appointmentData.cancellation_reason || 'Not specified'}. Please try booking another slot.`,
        related_entity_id: appointmentData._id,
        related_entity_type: 'DonationAppointment',
        action_url: '/donation-request'
      };
    }

    // Create notification record
    const notification = new Notification(notificationData);
    await notification.save();

    // Mock sending FCM push notification
    const donor = await User.findById(donorUserId).select('fcmToken name email');
    const bloodbank = await User.findById(appointmentData.bloodbank_id).select('name');
    
    console.log('🔔 NOTIFICATION SENT TO DONOR:');
    console.log('  Donor:', donor?.name || 'Unknown');
    console.log('  Email:', donor?.email);
    console.log('  Type:', status === 'approved' ? 'APPOINTMENT APPROVED' : 'APPOINTMENT DECLINED');
    console.log('  Date & Time:', new Date(appointmentData.appointment_date).toLocaleDateString(), appointmentData.appointment_time);
    console.log('  Bloodbank:', bloodbank?.name);
    if (status === 'cancelled') console.log('  Reason:', appointmentData.cancellation_reason);
    if (donor?.fcmToken) {
      console.log('  📱 FCM Push would be sent to token:', donor.fcmToken);
    }
    console.log('  ✉️ Email notification would be triggered');
    console.log('  📲 In-app notification saved to database');

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    // Don't throw - notification failure shouldn't block appointment update
  }
}

// Approve a donation appointment
export async function PUT(req, { params }) {
  try {
    const appointmentId = params.id;
    const action = req.nextUrl.searchParams.get('action');

    console.log(`PUT /api/donation-appointments/${appointmentId} - Action: ${action}`);

    // Authenticate user (must be bloodbank_admin)
    const auth = await requireAuth(req, { requiredRole: 'bloodbank_admin' });
    if (!auth.valid) {
      console.log('PUT /api/donation-appointments - Auth failed:', auth.response?.body);
      return auth.response;
    }

    await connectDB();
    console.log('PUT /api/donation-appointments - DB connected');

    const body = await req.json();

    // Find appointment and verify it belongs to this bloodbank
    const appointment = await DonationAppointment.findById(appointmentId);
    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Verify bloodbank authorization - compare as strings
    const appointmentBankId = appointment.bloodbank_id.toString();
    const currentUserId = String(auth.userId);
    
    console.log('Authorization check:', {
      appointmentBankId,
      currentUserId,
      match: appointmentBankId === currentUserId
    });

    if (appointmentBankId !== currentUserId) {
      return NextResponse.json(
        { error: "Unauthorized: This appointment does not belong to your blood bank" },
        { status: 403 }
      );
    }

    // Handle different actions
    if (action === 'approve') {
      if (appointment.status !== 'pending') {
        return NextResponse.json(
          { error: "Only pending appointments can be approved" },
          { status: 400 }
        );
      }
      appointment.status = 'approved';
      appointment.notes = body.notes || appointment.notes;
      await appointment.save();
      console.log(`PUT /api/donation-appointments/${appointmentId} - Approved`);

      // Send notification to donor
      await sendNotificationToDonor(appointment.user_id, appointment, 'approved');

      return NextResponse.json({
        success: true,
        message: "Appointment approved successfully",
        appointment
      });

    } else if (action === 'decline') {
      if (appointment.status !== 'pending') {
        return NextResponse.json(
          { error: "Only pending appointments can be declined" },
          { status: 400 }
        );
      }
      appointment.status = 'cancelled';
      appointment.cancellation_reason = body.cancellation_reason || "Declined by blood bank";
      await appointment.save();
      console.log(`PUT /api/donation-appointments/${appointmentId} - Declined`);

      // Send notification to donor
      await sendNotificationToDonor(appointment.user_id, appointment, 'cancelled');

      return NextResponse.json({
        success: true,
        message: "Appointment declined successfully",
        appointment
      });

    } else if (action === 'complete') {
      if (appointment.status !== 'approved') {
        return NextResponse.json(
          { error: "Only approved appointments can be marked as completed" },
          { status: 400 }
        );
      }
      appointment.status = 'completed';
      appointment.notes = body.notes || appointment.notes;
      await appointment.save();
      console.log(`PUT /api/donation-appointments/${appointmentId} - Completed`);

      return NextResponse.json({
        success: true,
        message: "Appointment marked as completed",
        appointment
      });

    } else {
      return NextResponse.json(
        { error: "Invalid action. Please specify: approve, decline, or complete" },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error(`PUT /api/donation-appointments - Error:`, error);
    return NextResponse.json(
      { error: "Failed to update appointment", details: error.message },
      { status: 500 }
    );
  }
}
