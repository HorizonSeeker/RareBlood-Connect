import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import HospitalProfile from "@/models/HospitalProfile.js";
import Donor from "@/models/Doner.js";

/**
 * Debug endpoint to check verification queue status
 * GET /api/admin/verification-debug
 * Returns counts of hospitals and donors by verification status
 */
export async function GET(req) {
  try {
    await connectDB();

    // Get all hospitals by status
    const hospitalsByStatus = await HospitalProfile.aggregate([
      {
        $group: {
          _id: '$verification_status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get all donors by status
    const donorsByStatus = await Donor.aggregate([
      {
        $group: {
          _id: '$verification_status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get sample pending hospitals
    const pendingHospitals = await HospitalProfile.find({ verification_status: 'pending' })
      .populate('user_id', 'email name')
      .limit(5);

    // Get sample pending donors
    const pendingDonors = await Donor.find({ verification_status: 'PENDING' })
      .populate('user_id', 'email name')
      .limit(5);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      hospitals: {
        byStatus: hospitalsByStatus,
        samplePending: pendingHospitals.map(h => ({
          id: h._id,
          name: h.name,
          email: h.user_id?.email,
          status: h.verification_status,
          hasLicense: !!h.hospital_license_url
        }))
      },
      donors: {
        byStatus: donorsByStatus,
        samplePending: pendingDonors.map(d => ({
          id: d._id,
          name: d.user_id?.name,
          email: d.user_id?.email,
          status: d.verification_status,
          bloodType: d.blood_type
        }))
      }
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
