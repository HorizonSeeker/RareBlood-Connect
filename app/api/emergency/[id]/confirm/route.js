import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/authMiddleware";
import connectDB from "@/db/connectDB.mjs";
import BloodRequest from "@/models/BloodRequest.js";
import Donor from "@/models/Doner.js";
import User from "@/models/User.js";

/**
 * PATCH /api/emergency/[id]/confirm
 * 
 * Donor confirms they are on their way to donate blood for an emergency request
 * Updates units_fulfilled when donor confirms they will donate
 * 
 * Request body:
 * {
 *   unitsOffered: number (optional, default 1)
 * }
 */
export async function PATCH(req, { params }) {
  try {
    await connectDB();

    // Verify donor authentication
    const token = await getAuthToken(req);
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Please login or provide Bearer token" },
        { status: 401 }
      );
    }
    if (token.role !== 'user') {
      return NextResponse.json(
        { error: "Unauthorized - Donor access required" },
        { status: 403 }
      );
    }

    const { id } = params;

    // Verify request exists
    const emergencyRequest = await BloodRequest.findById(id);
    if (!emergencyRequest) {
      return NextResponse.json(
        { error: "Emergency request not found" },
        { status: 404 }
      );
    }

    // Verify request is in active status (ongoing broadcast)
    if (emergencyRequest.status !== "active") {
      return NextResponse.json(
        { error: "Request is not in active status for donations" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { unitsOffered = 1 } = body;

    // Validate units offered
    if (typeof unitsOffered !== 'number' || unitsOffered <= 0) {
      return NextResponse.json(
        { error: "Invalid units offered - must be a positive number" },
        { status: 400 }
      );
    }

    // Get donor info
    const donor = await Donor.findOne({ user_id: auth.userId });
    if (!donor) {
      return NextResponse.json(
        { error: "Donor profile not found" },
        { status: 404 }
      );
    }

    // Get user info
    const user = await User.findById(auth.userId);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if donor is already in confirmed_donors list
    const alreadyConfirmed = emergencyRequest.confirmed_donors?.some(
      donorId => donorId.toString() === donor._id.toString()
    );

    if (alreadyConfirmed) {
      return NextResponse.json(
        { 
          warning: "Donor already confirmed for this request",
          units_fulfilled: emergencyRequest.units_fulfilled,
          confirmed_donors_count: emergencyRequest.confirmed_donors?.length || 0
        },
        { status: 200 }
      );
    }

    // Add donor to confirmed_donors and update units_fulfilled
    emergencyRequest.confirmed_donors = emergencyRequest.confirmed_donors || [];
    emergencyRequest.confirmed_donors.push(donor._id);
    emergencyRequest.units_fulfilled = (emergencyRequest.units_fulfilled || 0) + unitsOffered;

    // If units fulfilled meet or exceed required, mark as resolved
    if (emergencyRequest.units_fulfilled >= emergencyRequest.units_required) {
      emergencyRequest.status = "resolved";
      console.log(`✅ Emergency request ${id} fulfilled by ${emergencyRequest.confirmed_donors.length} donors`);
    }

    await emergencyRequest.save();

    // Log donor action
    console.log(`✅ Donor ${donor._id} (${user.email}) confirmed for emergency request ${id}`);
    console.log(`📊 Units fulfilled: ${emergencyRequest.units_fulfilled}/${emergencyRequest.units_required}`);

    return NextResponse.json({
      success: true,
      message: `✅ Thank you! You confirmed to donate ${unitsOffered} unit(s). We're on our way to help!`,
      confirmed: true,
      donor: {
        id: donor._id,
        name: user.name,
        bloodType: donor.blood_type
      },
      request: {
        id: emergencyRequest._id,
        blood_type: emergencyRequest.blood_type,
        units_required: emergencyRequest.units_required,
        units_fulfilled: emergencyRequest.units_fulfilled,
        status: emergencyRequest.status,
        confirmed_donors_count: emergencyRequest.confirmed_donors?.length || 0,
        hospital_location: emergencyRequest.hospital_location
      },
      progressPercentage: Math.min(
        (emergencyRequest.units_fulfilled / emergencyRequest.units_required) * 100,
        100
      )
    }, { status: 200 });

  } catch (error) {
    console.error("Donor confirm donation error:", error);
    return NextResponse.json(
      { error: "Failed to confirm donation", details: error.message },
      { status: 500 }
    );
  }
}
