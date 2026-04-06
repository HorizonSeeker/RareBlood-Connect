import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB";
import User from "@/models/User.js";
import HospitalProfile from "@/models/HospitalProfile.js";
import bcrypt from "bcrypt"; // <- THÊM DÒNG NÀY

export async function POST(req) {
  await connectDB();

  try {
    const body = await req.json();
    // Also grab 'password' and 'contact_number' from the request body
    const { name, age, blood_type, mobile_number, contact_number, email, role, password } = body;
    // Accept either mobile_number or contact_number (some client forms use contact_number)
    const mobile = mobile_number || contact_number;

    // Validate required fields
    // Ensure password is present and use 'mobile' as fallback for contact_number
    if (!name || !mobile || !email || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate role is one of the allowed values
    const allowedRoles = ["user", "hospital", "bloodbank_admin"];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      // User already exists, check if they have role set
      // This can happen when user signs up as donor first, then changes to hospital
      if (existingUserByEmail.role && existingUserByEmail.role !== 'hospital') {
        // User has a different role, can't change it this way
        return NextResponse.json(
          { error: "User already registered with a different role" },
          { status: 409 }
        );
      }
      
      // User exists but has no role or same role, proceed to update
      console.log('🔵 User already exists, updating hospital profile:', existingUserByEmail._id);
      
      // Validate required fields for hospital
      if (!body.address || !body.latitude || !body.longitude) {
        return NextResponse.json(
          { error: "Address, latitude, and longitude are required for hospital registration" },
          { status: 400 }
        );
      }
      
      // Update existing user
      const updatedUser = await User.findByIdAndUpdate(
        existingUserByEmail._id,
        {
          $set: {
            name,
            role: 'hospital',
            isRegistrationComplete: true
          }
        },
        { new: true }
      );

      // Create or update hospital profile
      let hospital = await HospitalProfile.findOne({ user_id: existingUserByEmail._id });
      if (hospital) {
        hospital = await HospitalProfile.findByIdAndUpdate(
          hospital._id,
          {
            name,
            contact_number: mobile,
            latitude: body.latitude,
            longitude: body.longitude,
            address: body.address
          },
          { new: true }
        );
      } else {
        hospital = await HospitalProfile.create({
          user_id: existingUserByEmail._id,
          name,
          contact_number: mobile,
          latitude: body.latitude,
          longitude: body.longitude,
          address: body.address
        });
      }

      console.log('✅ Hospital profile updated for existing user');
      return NextResponse.json(
        { 
          message: "Hospital registered successfully", 
          user: {
            id: updatedUser._id,
            email: updatedUser.email,
            role: updatedUser.role,
            isRegistrationComplete: updatedUser.isRegistrationComplete
          },
          hospital
        },
        { status: 201 }
      );
    }

    const existingUserByMobile = await User.findOne({ mobile_number: mobile });
    if (existingUserByMobile) {
      return NextResponse.json(
        { error: "Mobile number already registered" },
        { status: 409 }
      );
    }

    // Password is required only when creating a new user
    if (!password) {
      return NextResponse.json(
        { error: "Password is required for new registration" },
        { status: 400 }
      );
    }

    // ✅ FIX: Add password strength validation
    // Requires: min 12 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
    
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        {
          error: "Password must be at least 12 characters with uppercase, lowercase, number, and special character",
          errorCode: 'WEAK_PASSWORD',
          requirements: {
            minLength: 12,
            requireUppercase: true,
            requireLowercase: true,
            requireNumber: true,
            requireSpecialChar: true,
            allowedSpecialChars: '@$!%*?&'
          }
        },
        { status: 400 }
      );
    }

    // --- START FIX ---

    // 1. Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 2. Create user with the hashed password
    const newUser = await User.create({
      name,
      age,
      blood_type,
      mobile_number: mobile,
      email,
      role,
      password: hashedPassword, // store hashed password
    });

    // If the new user is a hospital and hospital fields were provided, create a hospital profile
    if (role === 'hospital') {
      const { address, latitude, longitude } = body;
      
      // Validate hospital fields
      if (!address || !latitude || !longitude) {
        console.error('❌ Hospital profile missing required fields:', { address, latitude, longitude });
        return NextResponse.json(
          { error: "Hospital registration requires address, latitude, and longitude" },
          { status: 400 }
        );
      }
      
      try {
        const profile = await HospitalProfile.create({
          user_id: newUser._id,
          name: name,
          address,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          contact_number: mobile
        });
        
        // Mark registration as complete
        newUser.isRegistrationComplete = true;
        await newUser.save();

        const safeUser = {
          id: newUser._id,
          email: newUser.email,
          role: newUser.role,
          isRegistrationComplete: newUser.isRegistrationComplete
        };

        return NextResponse.json(
          { message: "User and hospital profile created", user: safeUser, profileId: profile._id },
          { status: 201 }
        );
      } catch (e) {
        console.error('❌ Failed to create hospital profile:', e);
        return NextResponse.json(
          { error: "Failed to create hospital profile: " + e.message },
          { status: 500 }
        );
      }
    }
    
    // --- END FIX ---

    const safeUser = {
      id: newUser._id,
      email: newUser.email,
      role: newUser.role,
      isRegistrationComplete: newUser.isRegistrationComplete || false
    };

    return NextResponse.json(
      { message: "User registered successfully", user: safeUser },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Failed to register user", details: error.message },
      { status: 500 }
    );
  }
}