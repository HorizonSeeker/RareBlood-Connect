import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import HospitalProfile from "@/models/HospitalProfile.js";
import User from "@/models/User.js";
import mongoose from "mongoose";

/**
 * Test endpoint to create test hospitals
 * POST /api/test/create-test-hospital
 * Body: { name, address, contact_number, email }
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { name, address, contact_number, email } = body;

    if (!name || !address || !contact_number || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: name, address, contact_number, email' },
        { status: 400 }
      );
    }

    await connectDB();

    // Create a test user if it doesn't exist
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        name: `Admin for ${name}`,
        role: 'admin',
        isRegistrationComplete: true
      });
      console.log("✅ Created test user:", user._id);
    }

    // Create a test hospital profile
    const hospital = await HospitalProfile.create({
      user_id: user._id,
      name,
      address,
      contact_number,
      latitude: 10.7769,
      longitude: 106.6963,
      hospital_license_url: '/hospital-licenses/test-license.pdf',
      verification_status: 'pending',
      verification_requested_at: new Date()
    });

    console.log("✅ Created test hospital:", hospital._id);

    return NextResponse.json({
      success: true,
      message: 'Test hospital created successfully',
      hospital: {
        id: hospital._id,
        name: hospital.name,
        status: hospital.verification_status
      }
    });
  } catch (error) {
    console.error("Test creation error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test/create-test-hospital
 * Quickly create a test hospital with default values
 */
export async function GET(req) {
  try {
    await connectDB();

    const timestamp = Date.now();
    const testData = {
      name: `Test Hospital ${timestamp}`,
      address: `123 Test Street, Test City, Test Country`,
      contact_number: `+84123456${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      email: `hospital-test-${timestamp}@test.com`
    };

    // Create a test user
    let user = await User.create({
      email: testData.email,
      name: testData.name,
      role: 'hospital',
      isRegistrationComplete: true
    });

    // Create a test hospital profile
    const hospital = await HospitalProfile.create({
      user_id: user._id,
      name: testData.name,
      address: testData.address,
      contact_number: testData.contact_number,
      latitude: 10.7769 + (Math.random() - 0.5) * 0.1,
      longitude: 106.6963 + (Math.random() - 0.5) * 0.1,
      hospital_license_url: `/hospital-licenses/test-${timestamp}.pdf`,
      verification_status: 'pending',
      verification_requested_at: new Date()
    });

    console.log("✅ Test hospital created successfully");

    return NextResponse.json({
      success: true,
      message: 'Test hospital created successfully',
      data: {
        user: { id: user._id, email: user.email },
        hospital: {
          id: hospital._id,
          name: hospital.name,
          status: hospital.verification_status
        }
      }
    });
  } catch (error) {
    console.error("Test hospital creation error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
