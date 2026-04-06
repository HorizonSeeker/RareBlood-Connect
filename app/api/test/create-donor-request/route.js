import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import DonorContactRequest from "@/models/DonorContactRequest.js";
import Donor from "@/models/Doner.js";
import User from "@/models/User.js";
import admin from "@/config/firebase.mjs";

export async function POST(req) {
  try {
    await connectDB();
    
    const body = await req.json();
    const { donorUserId, requesterUserId, bloodType, urgencyLevel, message } = body;

    // Find the donor by user_id
    const donor = await Donor.findOne({ user_id: donorUserId });
    if (!donor) {
      return NextResponse.json(
        { error: "Donor not found" },
        { status: 404 }
      );
    }

    // Verify requester exists
    const requester = await User.findById(requesterUserId);
    if (!requester) {
      return NextResponse.json(
        { error: "Requester not found" },
        { status: 404 }
      );
    }

    // Create the request
    const newRequest = await DonorContactRequest.create({
      requesterId: requesterUserId,
      donorId: donor._id,
      bloodType: bloodType || 'A+',
      urgencyLevel: urgencyLevel || 'High',
      message: message || 'Urgent blood needed for patient'
    });

    const populatedRequest = await DonorContactRequest.findById(newRequest._id)
      .populate('requesterId', 'name email role')
      .populate('donorId', 'user_id blood_type');

    console.log("✅ Created test DonorContactRequest:", populatedRequest);

    // Step 2: Send FCM notification to donor if they have a token
    // Try to get token from donor profile first, then fallback to user profile
    let fcmToken = donor.fcmToken;
    if (!fcmToken) {
      const donorUser = await User.findById(donor.user_id);
      fcmToken = donorUser?.fcmToken;
    }

    if (fcmToken) {
      try {
        const fcmMessage = {
          notification: {
            title: '🩸 Blood Request',
            body: `Urgent request for ${bloodType} blood (${urgencyLevel} priority)`
          },
          data: {
            requestId: newRequest._id.toString(),
            requesterName: requester.name,
            bloodType: bloodType || 'A+',
            urgencyLevel: urgencyLevel || 'High',
            message: message || 'Urgent blood needed'
          },
          token: fcmToken
        };

        const fcmResponse = await admin.messaging().send(fcmMessage);
        console.log('✅ FCM notification sent:', fcmResponse);
      } catch (fcmError) {
        console.error('❌ Failed to send FCM notification:', fcmError);
        // Continue - request created even if FCM fails
      }
    } else {
      console.log('⚠️ Donor has no FCM token registered');
    }

    return NextResponse.json({
      success: true,
      request: populatedRequest
    });

  } catch (error) {
    console.error("❌ Error creating test request:", error);
    return NextResponse.json(
      { error: "Failed to create test request", details: error.message },
      { status: 500 }
    );
  }
}