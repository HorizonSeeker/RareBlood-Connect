import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import DonationDrive from "@/models/DonationDrive.js";
import User from "@/models/User.js";
import { getAuthToken } from "@/lib/authMiddleware";

// Get all drives for a bloodbank
export async function GET(req) {
  try {
    console.log("🔵 [Bloodbank/Drives] GET - Fetching drives");
    
    // Use getAuthToken which supports BOTH NextAuth cookies AND Bearer tokens
    const token = await getAuthToken(req);
    if (!token) {
      console.error("❌ [Bloodbank/Drives] No valid token found");
      return NextResponse.json({ error: "Unauthorized - No valid session" }, { status: 401 });
    }

    // Check if user is bloodbank_admin
    if (token.role !== "bloodbank_admin") {
      console.error("❌ [Bloodbank/Drives] User is not bloodbank_admin, role:", token.role);
      return NextResponse.json({ error: "Forbidden - Bloodbank admin access required" }, { status: 403 });
    }

    const userId = token.userId || token.sub;
    console.log("✅ [Bloodbank/Drives] User authenticated as bloodbank_admin:", userId);

    await connectDB();

    const drives = await DonationDrive.find({
      organizer_id: userId,
      organizer_type: 'bloodbank_admin'
    })
    .populate('organizer_id', 'name email')
    .sort({ date: -1 });

    console.log("✅ [Bloodbank/Drives] Fetched drives:", drives.length);
    
    return NextResponse.json({
      success: true,
      drives
    });
  } catch (error) {
    console.error("❌ [Bloodbank/Drives] Error fetching drives:", error);
    return NextResponse.json(
      { error: "Failed to fetch drives", details: error.message },
      { status: 500 }
    );
  }
}

// Create a new donation drive
export async function POST(req) {
  try {
    console.log('🔵 [Bloodbank/Drives] POST - Starting...');
    
    // Use getAuthToken which supports BOTH NextAuth cookies AND Bearer tokens
    const token = await getAuthToken(req);
    if (!token) {
      console.log('❌ [Bloodbank/Drives] POST - Auth failed: No valid token found');
      return NextResponse.json(
        { error: "Unauthorized - No valid session" },
        { status: 401 }
      );
    }

    // Check if user is bloodbank_admin
    if (token.role !== "bloodbank_admin") {
      console.error("❌ [Bloodbank/Drives] POST - User is not bloodbank_admin, role:", token.role);
      return NextResponse.json({ error: "Forbidden - Bloodbank admin access required" }, { status: 403 });
    }

    const userId = token.userId || token.sub;
    console.log('✅ [Bloodbank/Drives] POST - Auth successful for user:', userId);
    
    await connectDB();
    console.log('✅ [Bloodbank/Drives] POST - DB connected');

    const body = await req.json();
    console.log('POST /api/bloodbank/drives - Request body:', body);
    const {
      title,
      description,
      location,
      date,
      start_time,
      end_time,
      required_blood_types,
      contact_number
    } = body;

    // Validate required fields
    if (!title || !description || !location || !date || !start_time || !end_time || !contact_number) {
      return NextResponse.json(
        { error: "All required fields must be provided" },
        { status: 400 }
      );
    }

    // Validate date is in the future
    const driveDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (driveDate < today) {
      return NextResponse.json(
        { error: "Drive date must be in the future" },
        { status: 400 }
      );
    }

    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
      return NextResponse.json(
        { error: "Invalid time format" },
        { status: 400 }
      );
    }

    // Create new drive
    const driveData = {
      organizer_id: userId,
      organizer_type: 'bloodbank_admin',
      title,
      description,
      location,
      date: driveDate,
      start_time,
      end_time,
      required_blood_types: required_blood_types || [],
      contact_number
    };
    
    console.log('POST /api/bloodbank/drives - Creating drive with data:', driveData);
    
    const newDrive = new DonationDrive(driveData);

    await newDrive.save();

    // Populate organizer info for response
    await newDrive.populate('organizer_id', 'name email');

    console.log('✅ [Bloodbank/Drives] POST - Drive created successfully:', newDrive._id);
    
    return NextResponse.json({
      success: true,
      message: "Donation drive created successfully",
      drive: newDrive
    }, { status: 201 });

  } catch (error) {
    console.error("❌ [Bloodbank/Drives] POST - Error creating drive:", error);
    console.error("Error stack:", error.stack);
    return NextResponse.json(
      { error: "Failed to create donation drive", details: error.message },
      { status: 500 }
    );
  }
}