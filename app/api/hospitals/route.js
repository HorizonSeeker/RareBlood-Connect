import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/authMiddleware";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import connectDB from "@/db/connectDB.mjs";
import HospitalProfile from "@/models/HospitalProfile.js";
import User from "@/models/User.js";

export async function POST(req) {
  try {
    await connectDB();

    const token = await getAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - Please login or provide Bearer token' }, { status: 401 });
    }

    // Use our custom token.userId
    const userId = token.userId || token.sub;
    if (!userId) {
      console.error("Hospital registration: Missing userId in token", token);
      return NextResponse.json({ error: 'Unauthorized - No user id' }, { status: 401 });
    }

    // Check if this is FormData (multipart/form-data) or JSON
    const contentType = req.headers.get('content-type') || '';
    let data = {};
    
    if (contentType.includes('multipart/form-data')) {
      // Parse FormData
      const formData = await req.formData();
      
      // Extract text fields
      data.name = formData.get('name');
      data.address = formData.get('address');
      data.contact_number = formData.get('contact_number');
      data.email = formData.get('email');
      data.password = formData.get('password');
      data.latitude = formData.get('latitude');
      data.longitude = formData.get('longitude');
      
      // Handle file upload
      const file = formData.get('hospital_license');
      if (file) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const filename = `${Date.now()}-${file.name}`;
        const uploadDir = join(process.cwd(), 'public', 'hospital-licenses');
        const filepath = join(uploadDir, filename);
        
        try {
          // Create directory if it doesn't exist
          await mkdir(uploadDir, { recursive: true });
          await writeFile(filepath, buffer);
          data.hospital_license_url = `/hospital-licenses/${filename}`;
          console.log(`✅ Hospital license saved: ${data.hospital_license_url}`);
        } catch (fileErr) {
          console.error("Failed to save hospital license:", fileErr);
          return NextResponse.json({ error: 'Failed to save license file' }, { status: 500 });
        }
      }
    } else {
      // Parse JSON
      data = await req.json();
    }
    
    console.log("Hospital registration token:", { userId, tokenUserId: token.userId, tokenSub: token.sub });
    console.log("Hospital registration payload:", { name: data.name, address: data.address, license_url: data.hospital_license_url });

    // Load user then set registration complete (avoid silent no-op if userId invalid)
    let user = await User.findById(userId);
    if (!user) {
      console.error("Hospital registration: User not found with ID:", userId);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const wasComplete = user.isRegistrationComplete;
    if (!user.isRegistrationComplete) {
      user.isRegistrationComplete = true;
      await user.save();
    }

    console.log("Hospital registration: User completion status -> before:", wasComplete, "after:", user.isRegistrationComplete);

    // Ensure we don't create duplicate profile (idempotent check)
    let existingProfile = await HospitalProfile.findOne({ user_id: user._id });
    if (existingProfile) {
      console.log("Hospital registration: Existing profile found, updating", existingProfile._id);
      existingProfile.name = data.name ?? existingProfile.name;
      existingProfile.address = data.address ?? existingProfile.address;
      if (data.latitude) existingProfile.latitude = parseFloat(data.latitude);
      if (data.longitude) existingProfile.longitude = parseFloat(data.longitude);
      existingProfile.contact_number = data.contact_number ?? existingProfile.contact_number;
      if (data.hospital_license_url) {
        existingProfile.hospital_license_url = data.hospital_license_url;
        existingProfile.verification_status = 'pending';
      }
      await existingProfile.save();
    } else {
      existingProfile = await HospitalProfile.create({
        user_id: user._id,
        name: data.name,
        address: data.address,
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        contact_number: data.contact_number,
        hospital_license_url: data.hospital_license_url || null,
        // Always set to 'pending' for admin verification, regardless of license
        // Hospitals without license will show as pending with a note
        verification_status: 'pending'
      });
      console.log("Hospital registration: New hospital profile created:", existingProfile._id);
    }

    // Echo back definitive state from DB
    return NextResponse.json({
      success: true,
      message: 'Hospital profile saved',
      isRegistrationComplete: user.isRegistrationComplete,
      profileId: existingProfile._id
    });

  } catch (error) {
    console.error("Hospital registration error:", error);
    return NextResponse.json({ error: 'Failed to create hospital profile', details: error.message }, { status: 500 });
  }
}

// Get all hospitals or filter by ID
export async function GET(req) {
  await connectDB();
  
  try {
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get("user_id");
    
    if (user_id) {
      // Get specific hospital profile
      const profile = await HospitalProfile.findOne({ user_id });
      
      if (!profile) {
        return NextResponse.json(
          { error: "Hospital profile not found" },
          { status: 404 }
        );
      }
      
      return NextResponse.json({ profile }, { status: 200 });
    } else {
      // Get all hospital profiles
      const profiles = await HospitalProfile.find();
      return NextResponse.json({ profiles }, { status: 200 });
    }
  } catch (error) {
    console.error("Error fetching hospital profiles:", error);
    return NextResponse.json(
      { error: "Failed to fetch hospital profiles" },
      { status: 500 }
    );
  }
}

// Update a hospital profile
export async function PUT(req) {
  await connectDB();
  
  try {
    const body = await req.json();
    const { user_id, name, address, latitude, longitude, contact_number } = body;
    
    if (!user_id) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }
    
    const updateData = {};
    if (name) updateData.name = name;
    if (address) updateData.address = address;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (contact_number) updateData.contact_number = contact_number;
    
    const updatedProfile = await HospitalProfile.findOneAndUpdate(
      { user_id },
      updateData,
      { new: true }
    );
    
    if (!updatedProfile) {
      return NextResponse.json(
        { error: "Hospital profile not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { message: "Hospital profile updated successfully", profile: updatedProfile },
      { status: 200 }
    );
  } catch (error) {
    console.error("Hospital profile update error:", error);
    return NextResponse.json(
      { error: "Failed to update hospital profile" },
      { status: 500 }
    );
  }
}