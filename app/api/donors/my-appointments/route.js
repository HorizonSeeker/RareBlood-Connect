import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import DonationAppointment from "@/models/DonationAppointment.js";
import User from "@/models/User.js";
import { requireAuth } from "@/lib/authMiddleware";

// Get all donation appointments for the logged-in donor
export async function GET(req) {
  try {
    console.log('GET /api/donors/my-appointments - Starting...');
    
    // Authenticate user (must be a donor/user)
    const auth = await requireAuth(req, { requiredRoles: ['user'] });
    if (!auth.valid) {
      console.log('GET /api/donors/my-appointments - Auth failed:', auth.response?.body);
      return auth.response;
    }

    await connectDB();
    console.log('GET /api/donors/my-appointments - DB connected');

    // Get all appointments for this donor, sorted by date
    const appointments = await DonationAppointment.find({ user_id: auth.userId })
      .populate({
        path: 'bloodbank_id',
        select: '_id name address phone latitude longitude',
      })
      .sort({ appointment_date: -1, appointment_time: -1 });

    console.log('GET /api/donors/my-appointments - Found', appointments.length, 'appointments');

    // Format response
    const formattedAppointments = appointments.map(apt => ({
      _id: apt._id,
      bloodbank_name: apt.bloodbank_id.name,
      bloodbank_id: apt.bloodbank_id._id,
      bloodbank_info: {
        name: apt.bloodbank_id.name,
        address: apt.bloodbank_id.address || 'Not available',
        phone: apt.bloodbank_id.phone || 'Not available',
        latitude: apt.bloodbank_id.latitude,
        longitude: apt.bloodbank_id.longitude
      },
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
    console.error("GET /api/donors/my-appointments - Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointments", details: error.message },
      { status: 500 }
    );
  }
}
