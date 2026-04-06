import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import HospitalProfile from "@/models/HospitalProfile.js";
import Donor from "@/models/Doner.js";
import User from "@/models/User.js";

/**
 * Quick debug endpoint to check hospital verification status
 * GET /api/test/check-hospitals
 */
export async function GET(req) {
  try {
    await connectDB();

    console.log("🔵 === HOSPITAL VERIFICATION DEBUG ===");

    // Get total hospitals
    const totalHospitals = await HospitalProfile.countDocuments();
    console.log("📊 Total hospitals in DB:", totalHospitals);

    // Get hospitals by status
    const hospitalsByStatus = await HospitalProfile.aggregate([
      { $group: { _id: '$verification_status', count: { $sum: 1 } } }
    ]);
    console.log("📊 Hospitals by status:", hospitalsByStatus);

    // Get pending hospitals with details
    const pending = await HospitalProfile.find({ verification_status: 'pending' })
      .populate('user_id', 'email name role')
      .lean();
    console.log("📊 Pending hospitals count:", pending.length);
    pending.forEach(h => console.log(`  - ${h.name} (${h.user_id?.email}) - has_license: ${!!h.hospital_license_url}`));

    // Get total users
    const totalUsers = await User.countDocuments();
    const adminUsers = await User.countDocuments({ role: 'admin' });
    console.log("📊 Total users:", totalUsers, "- Admin users:", adminUsers);

    // Get donors by status
    const donorsByStatus = await Donor.aggregate([
      { $group: { _id: '$verification_status', count: { $sum: 1 } } }
    ]);
    console.log("📊 Donors by status:", donorsByStatus);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      hospitals: {
        total: totalHospitals,
        byStatus: hospitalsByStatus,
        pendingList: pending.map(h => ({
          id: h._id,
          name: h.name,
          email: h.user_id?.email,
          status: h.verification_status,
          hasLicense: !!h.hospital_license_url,
          createdAt: h.createdAt
        }))
      },
      donors: {
        byStatus: donorsByStatus
      },
      users: {
        total: totalUsers,
        admins: adminUsers
      }
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
