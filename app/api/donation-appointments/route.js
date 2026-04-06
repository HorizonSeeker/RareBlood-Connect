import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import DonationAppointment from "@/models/DonationAppointment.js";
import Doner from "@/models/Doner.js";
import User from "@/models/User.js";
import { requireAuth } from "@/lib/authMiddleware";

// Get all donation appointments for a bloodbank
export async function GET(req) {
  try {
    console.log('GET /api/donation-appointments - Starting...');
    
    // Authenticate user (must be bloodbank_admin)
    const auth = await requireAuth(req, { requiredRole: 'bloodbank_admin' });
    if (!auth.valid) {
      console.log('GET /api/donation-appointments - Auth failed:', auth.response?.body);
      return auth.response;
    }

    await connectDB();
    console.log('GET /api/donation-appointments - DB connected');

    // Get all appointments for this bloodbank, populated with donor info
    const appointments = await DonationAppointment.find({ bloodbank_id: auth.userId })
      .populate({
        path: 'donor_id',
        select: '_id blood_type',
      })
      .populate({
        path: 'user_id',
        select: 'name email',
      })
      .sort({ appointment_date: -1, appointment_time: -1 });

    console.log('GET /api/donation-appointments - Found', appointments.length, 'appointments');

    // Format response with donor info
    const formattedAppointments = appointments.map(apt => ({
      _id: apt._id,
      donor_id: apt.donor_id._id,
      donor_name: apt.user_id.name,
      donor_email: apt.user_id.email,
      blood_type: apt.donor_id.blood_type,
      appointment_date: apt.appointment_date,
      appointment_time: apt.appointment_time,
      status: apt.status,
      cancellation_reason: apt.cancellation_reason,
      notes: apt.notes,
      created_at: apt.created_at,
      updated_at: apt.updated_at
    }));

    return NextResponse.json({
      success: true,
      appointments: formattedAppointments
    });

  } catch (error) {
    console.error("GET /api/donation-appointments - Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointments", details: error.message },
      { status: 500 }
    );
  }
}
