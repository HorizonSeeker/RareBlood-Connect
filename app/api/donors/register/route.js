import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/authMiddleware";
import connectDB from "@/db/connectDB.mjs";
import Donor from "@/models/Doner.js";
import User from "@/models/User.js";
import fs from "fs";
import path from "path";

export async function POST(req) {
  console.log("🔵 Donor registration endpoint called");
  console.log("🔵 Request headers:", {
    cookie: req.headers.get('cookie'),
    host: req.headers.get('host'),
    origin: req.headers.get('origin'),
    'user-agent': req.headers.get('user-agent'),
    'content-type': req.headers.get('content-type')
  });
  
  try {
    console.log("🔵 Connecting to database...");
    await connectDB();
    console.log("✅ Database connected");

    // Get the JWT token to identify the current user
    console.log("🔵 Getting JWT token...");
    
    const token = await getAuthToken(req);
    console.log("🔵 Token received:", { userId: token?.userId || token?.sub, email: token?.email, role: token?.role });
    
    let authToken = null;
    if (token) {
      authToken = { userId: token.userId || token.sub };
    }
    
    // Parse request body - handle both JSON and FormData
    let body;
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      console.log("🔵 Parsing FormData...");
      body = await req.formData();
      console.log("🔵 FormData keys:", Array.from(body.keys()));
    } else {
      console.log("🔵 Parsing JSON...");
      body = await req.json();
      console.log("🔵 FULL REQUEST BODY:", JSON.stringify(body, null, 2));
    }

    const getField = (key) => contentType.includes('multipart/form-data') ? body.get(key) : body[key];

    const name = getField('name');
    const dateOfBirth = getField('dateOfBirth');
    const gender = getField('gender');
    const age = getField('age');
    const weight = getField('weight');
    const blood_type = getField('blood_type');
    const mobile_number = getField('mobile_number');
    const emergency_contact_mobile = getField('emergency_contact_mobile');
    const address = getField('address');
    const latitude = getField('latitude');
    const longitude = getField('longitude');
    const medicalProof = getField('medicalProof');
    const userIdBody = getField('userId');

    console.log("🔵 Request data:", { name, age, weight, blood_type, mobile_number, emergency_contact_mobile, address, latitude, longitude, medicalProof: medicalProof ? 'file present' : 'no file' });
    console.log("🔵 userId from body:", userIdBody);

    // Try token first, fallback to body userId (for mobile/ngrok where cookies might not work)
    const userId = token?.userId || token?.sub || userIdBody;
    
    if (!userId) {
      console.log("❌ No valid userId found in token or body");
      return NextResponse.json(
        { error: "Unauthorized - Please login or provide Bearer token" },
        { status: 401 }
      );
    }
    
    console.log("✅ Using userId:", userId);

    // Validate required fields
    if (!name || !dateOfBirth || !gender || !age || !weight || !blood_type || !mobile_number || !emergency_contact_mobile || !address || !medicalProof) {
      console.log("❌ Missing required fields");
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate age requirement (must be 18+)
    const dob = new Date(dateOfBirth);
    const today = new Date();
    const calculatedAge = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    const isOldEnough = monthDiff > 0 || (monthDiff === 0 && today.getDate() >= dob.getDate());
    const finalAge = isOldEnough ? calculatedAge : calculatedAge - 1;
    
    if (finalAge < 18) {
      console.log("❌ Age requirement not met:", finalAge);
      return NextResponse.json(
        { error: "You must be at least 18 years old to be a blood donor" },
        { status: 400 }
      );
    }

    // Validate gender
    if (!['Male', 'Female', 'Other'].includes(gender)) {
      console.log("❌ Invalid gender:", gender);
      return NextResponse.json(
        { error: "Invalid gender value" },
        { status: 400 }
      );
    }

    // Validate weight requirement
    const weightValue = parseFloat(weight);
    if (isNaN(weightValue) || weightValue < 50) {
      console.log("❌ Weight requirement not met:", weight);
      return NextResponse.json(
        { error: "Weight must be at least 50kg to be eligible as a donor" },
        { status: 400 }
      );
    }

    // Handle file upload for medical proof
    let medicalProofUrl = '';
    if (contentType.includes('multipart/form-data') && medicalProof) {
      console.log("🔵 Processing medical proof file upload...");
      try {
        const file = medicalProof;
        const fileName = `${userId}_${Date.now()}_${file.name}`;
        const uploadDir = path.join(process.cwd(), 'public', 'medical-proofs');
        
        // Ensure upload directory exists
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const filePath = path.join(uploadDir, fileName);
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(filePath, buffer);
        
        medicalProofUrl = `/medical-proofs/${fileName}`;
        console.log("✅ Medical proof uploaded:", medicalProofUrl);
      } catch (fileError) {
        console.error("❌ File upload error:", fileError);
        return NextResponse.json(
          { error: "Failed to upload medical proof file" },
          { status: 500 }
        );
      }
    } else {
      console.log("❌ Medical proof file is required");
      return NextResponse.json(
        { error: "Medical proof file is required" },
        { status: 400 }
      );
    }

    // Find the existing user
    console.log("🔵 Finding user in database...");
    const user = await User.findById(userId);
    console.log("🔵 User found:", { id: user?._id, email: user?.email, role: user?.role });
    if (!user) {
      console.log("❌ User not found in database");
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Verify user has the correct role
    if (user.role !== 'user') {
      console.log("❌ Invalid role for donor registration:", user.role);
      return NextResponse.json(
        { error: "Invalid role for donor registration" },
        { status: 403 }
      );
    }

    // Update user profile with donor-specific information
    console.log("🔵 Updating user profile...");
    let updatedUser;
    try {
      const userUpdateData = {
        name,
        phone: mobile_number, // Save mobile as phone
        mobile_number, // Also save as mobile_number
        emergency_contact_mobile, // Emergency contact
        address, // Address
        dateOfBirth: new Date(dateOfBirth), // Save date of birth
        gender, // Save gender
        weight: parseFloat(weight), // Save weight
        bloodType: blood_type, // Save blood type to User
        isRegistrationComplete: true // Mark registration as complete
      };
      
      // Add current_location if latitude/longitude provided
      if (latitude !== undefined && longitude !== undefined) {
        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);
        if (!isNaN(lat) && !isNaN(lon)) {
          userUpdateData.current_location = {
            type: 'Point',
            coordinates: [lon, lat] // GeoJSON format: [longitude, latitude]
          };
          console.log("🔵 Setting user current_location:", userUpdateData.current_location);
        }
      }
      
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { 
          $set: userUpdateData
        },
        { new: true }
      );
      console.log("✅ User updated with ALL data:", { 
        id: updatedUser._id, 
        name: updatedUser.name,
        phone: updatedUser.phone,
        mobile_number: updatedUser.mobile_number,
        emergency_contact_mobile: updatedUser.emergency_contact_mobile,
        address: updatedUser.address,
        dateOfBirth: updatedUser.dateOfBirth,
        gender: updatedUser.gender,
        weight: updatedUser.weight,
        bloodType: updatedUser.bloodType,
        currentLocation: updatedUser.current_location,
        isRegistrationComplete: updatedUser.isRegistrationComplete 
      });
    } catch (userUpdateError) {
      console.log("⚠️ User update failed, but continuing with donor profile creation:", userUpdateError.message);
      // If user update fails due to constraints, we can still create the donor profile
      // Just mark registration complete separately
      await User.updateOne(
        { _id: userId },
        { $set: { isRegistrationComplete: true } }
      );
      // Get the updated user
      updatedUser = await User.findById(userId);
    }

    // Create or update donor profile with donor-specific information
    console.log("🔵 Creating/updating donor profile...");
    const existingDonor = await Donor.findOne({ user_id: userId });
    let donor;
    
    if (existingDonor) {
      console.log("🔵 Updating existing donor profile...");
      const updateData = {
        dateOfBirth: new Date(dateOfBirth),
        gender,
        age,
        weight,  // Add weight field
        blood_type,
        mobile_number,
        emergency_contact_mobile,
        address,
        medicalProofUrl,
      };
      
      // Update location if provided
      if (latitude !== undefined && longitude !== undefined) {
        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);
        if (!isNaN(lat) && !isNaN(lon)) {
          updateData.current_location = {
            type: 'Point',
            coordinates: [lon, lat] // GeoJSON format: [longitude, latitude]
          };
          console.log("🔵 Location updated:", updateData.current_location);
        }
      }
      
      donor = await Donor.findByIdAndUpdate(
        existingDonor._id,
        updateData,
        { new: true }
      );
    } else {
      console.log("🔵 Creating new donor profile...");
      const donorData = {
        user_id: userId,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        age,
        weight,  // Add weight field
        blood_type,
        mobile_number,
        emergency_contact_mobile,
        address,
        medicalProofUrl,
        total_donations: 0
      };
      
      // Add location if provided
      if (latitude !== undefined && longitude !== undefined) {
        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);
        if (!isNaN(lat) && !isNaN(lon)) {
          donorData.current_location = {
            type: 'Point',
            coordinates: [lon, lat] // GeoJSON format: [longitude, latitude]
          };
          console.log("🔵 Location set:", donorData.current_location);
        }
      }
      
      donor = await Donor.create(donorData);
    }
    console.log("✅ Donor profile created/updated:", donor._id);

    console.log("Donor registration completed:", {
      userId: updatedUser._id,
      registrationComplete: updatedUser.isRegistrationComplete
    });

    console.log("✅ Registration successful, sending response");
    return NextResponse.json(
      { 
        message: "Donor registered successfully", 
        user: {
          id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          isRegistrationComplete: updatedUser.isRegistrationComplete
        },
        donor: donor 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ Donor registration error:", error);
    console.error("❌ Error stack:", error.stack);
    return NextResponse.json(
      { error: "Failed to register donor", details: error.message },
      { status: 500 }
    );
  }
}