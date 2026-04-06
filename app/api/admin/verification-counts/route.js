import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/authMiddleware";
import connectDB from "@/db/connectDB.mjs";
import HospitalProfile from "@/models/HospitalProfile.js";
import Donor from "@/models/Doner.js";

export async function GET(req) {
  try {
    console.log("🔵 [Verification-Counts] GET - Fetching admin verification counts");
    
    const token = await getAuthToken(req);
    if (!token) {
      console.error("❌ [Verification-Counts] No valid token found");
      return NextResponse.json({ error: "Unauthorized - No valid session" }, { status: 401 });
    }

    if (token.role !== "admin") {
      console.error("❌ [Verification-Counts] User is not admin, role:", token.role);
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    console.log("✅ [Verification-Counts] User authenticated as admin:", token.email);

    await connectDB();

    // Count pending hospitals
    const pendingHospitals = await HospitalProfile.countDocuments({ 
      verification_status: 'pending' 
    });

    // Count pending donors
    const pendingDonors = await Donor.countDocuments({ 
      verification_status: 'PENDING' 
    });

    console.log("✅ [Verification-Counts] Counts:", { pendingHospitals, pendingDonors });

    return NextResponse.json({
      success: true,
      pendingHospitals,
      pendingDonors,
      totalPending: pendingHospitals + pendingDonors
    });
  } catch (error) {
    console.error("❌ [Verification-Counts] Error fetching verification counts:", error);
    return NextResponse.json(
      { error: 'Failed to fetch verification counts', details: error.message },
      { status: 500 }
    );
  }
}
