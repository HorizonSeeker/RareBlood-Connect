import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import DonationAppointment from "@/models/DonationAppointment.js";
import Doner from "@/models/Doner.js";
import User from "@/models/User.js";
import { getAuthToken } from "@/lib/authMiddleware";
import mongoose from "mongoose";

// Get all bloodbanks for appointment booking
export async function GET(req) {
  try {
    console.log('GET /api/donation-requests - Fetching bloodbanks...');
    
    await connectDB();

    // Fetch all users with bloodbank_admin role
    const bloodbanks = await User.find({ role: 'bloodbank_admin' })
      .select('_id name email phone address')
      .sort({ name: 1 });

    console.log('GET /api/donation-requests - Found', bloodbanks.length, 'bloodbanks');

    return NextResponse.json({
      success: true,
      bloodbanks
    });
  } catch (error) {
    console.error("GET /api/donation-requests - Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bloodbanks", details: error.message },
      { status: 500 }
    );
  }
}

// Create a new donation appointment
export async function POST(req) {
  try {
    console.log('POST /api/donation-requests - Starting...');
    
    // Authenticate user (supports NextAuth cookie + Bearer token)
    const token = await getAuthToken(req);
    if (!token) {
      console.log('POST /api/donation-requests - Auth failed: No token found');
      return NextResponse.json(
        { error: 'Unauthorized - Please login or provide Bearer token' },
        { status: 401 }
      );
    }

    // Verify user role is 'user' or 'donor'
    if (!['user', 'donor'].includes(token.role)) {
      console.log('POST /api/donation-requests - Auth failed: Invalid role:', token.role);
      return NextResponse.json(
        { error: 'Access denied - Donor role required' },
        { status: 403 }
      );
    }

    const userId = token.userId || token.sub;
    console.log('POST /api/donation-requests - Auth successful for user:', userId);
    
    await connectDB();
    console.log('POST /api/donation-requests - DB connected');

    const body = await req.json();
    const { bloodbank_id, appointment_date, appointment_time } = body;

    console.log('POST /api/donation-requests/create - Request body:', body);

    // Validate required fields
    if (!bloodbank_id || !appointment_date || !appointment_time) {
      return NextResponse.json(
        { error: "Missing required fields: bloodbank_id, appointment_date, appointment_time" },
        { status: 400 }
      );
    }

    // Validate bloodbank_id is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(bloodbank_id)) {
      return NextResponse.json(
        { error: "Invalid blood bank ID format" },
        { status: 400 }
      );
    }

    // Convert to ObjectId
    const bloodbankObjectId = new mongoose.Types.ObjectId(bloodbank_id);
    // Verify bloodbank exists and has bloodbank_admin role
    const bloodbank = await User.findById(bloodbankObjectId);
    if (!bloodbank || bloodbank.role !== 'bloodbank_admin') {
      return NextResponse.json(
        { error: "Invalid blood bank selected" },
        { status: 400 }
      );
    }

    // Get donor profile for this user
    const donor = await Doner.findOne({ user_id: userId });
    if (!donor) {
      return NextResponse.json(
        { error: "Donor profile not found. Please complete your donor registration." },
        { status: 400 }
      );
    }

    // Validate date is in future
    const appointmentDate = new Date(appointment_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (appointmentDate < today) {
      return NextResponse.json(
        { error: "Appointment date must be in the future" },
        { status: 400 }
      );
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(appointment_time)) {
      return NextResponse.json(
        { error: "Time must be in HH:MM format (24-hour)" },
        { status: 400 }
      );
    }

    // Create new appointment
    const newAppointment = new DonationAppointment({
      donor_id: donor._id,
      user_id: userId,
      bloodbank_id: bloodbankObjectId,
      appointment_date: appointmentDate,
      appointment_time: appointment_time,
      status: 'pending'
    });

    await newAppointment.save();
    console.log('POST /api/donation-requests - Appointment created successfully:', newAppointment._id);

    return NextResponse.json({
      success: true,
      message: "Appointment booked successfully! Awaiting blood bank approval.",
      appointmentId: newAppointment._id,
      appointment: newAppointment
    }, { status: 201 });

  } catch (error) {
    console.error("POST /api/donation-requests - Error:", error);
    return NextResponse.json(
      { error: "Failed to create donation appointment", details: error.message },
      { status: 500 }
    );
  }
}
