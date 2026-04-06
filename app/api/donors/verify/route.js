import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/authMiddleware";
import connectDB from "@/db/connectDB.mjs";
import Donor from "@/models/Doner.js";
import User from "@/models/User.js";

export async function POST(req) {
  console.log("🔵 Donor verification endpoint called");

  try {
    await connectDB();
    console.log("✅ Database connected");

    // Get JWT token to verify admin access
    const token = await getAuthToken(req);
    console.log("🔵 Token received:", { userId: token?.userId || token?.sub, role: token?.role });

    if (!token) {
      console.log("❌ Unauthorized: No token provided");
      return NextResponse.json(
        { error: "Unauthorized - Please login or provide Bearer token" },
        { status: 401 }
      );
    }

    if (token.role !== "admin") {
      console.log("❌ Unauthorized: User is not admin");
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const { donorId, action } = await req.json();
    console.log("🔵 Request data:", { donorId, action });

    // Validate action
    if (!["approve", "reject"].includes(action)) {
      console.log("❌ Invalid action:", action);
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    if (!donorId) {
      console.log("❌ Missing donorId");
      return NextResponse.json(
        { error: "donorId is required" },
        { status: 400 }
      );
    }

    // Find donor
    console.log("🔵 Finding donor...");
    const donor = await Donor.findById(donorId).populate("user_id");
    if (!donor) {
      console.log("❌ Donor not found");
      return NextResponse.json(
        { error: "Donor not found" },
        { status: 404 }
      );
    }

    // Update verification status in both Donor and User models
    const newStatus = action === "approve" ? "VERIFIED" : "REJECTED";
    console.log("🔵 Updating verification status to:", newStatus);

    // Update Donor
    const updatedDonor = await Donor.findByIdAndUpdate(
      donorId,
      { verification_status: newStatus },
      { new: true }
    ).populate("user_id");

    // Update User
    await User.findByIdAndUpdate(
      donor.user_id._id,
      { verification_status: newStatus }
    );

    console.log("✅ Verification status updated for donor:", donor._id);
    console.log("✅ Verification status updated for user:", donor.user_id._id);

    return NextResponse.json(
      {
        message: `Donor ${action === "approve" ? "approved" : "rejected"} successfully`,
        donor: updatedDonor,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Donor verification error:", error);
    console.error("❌ Error stack:", error.stack);
    return NextResponse.json(
      { error: "Failed to verify donor", details: error.message },
      { status: 500 }
    );
  }
}
