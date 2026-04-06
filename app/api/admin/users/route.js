import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import User from "@/models/User.js";
import Donor from "@/models/Doner.js";
import HospitalProfile from "@/models/HospitalProfile.js";
import { getAuthToken } from "@/lib/authMiddleware";

export async function GET(req) {
  console.log("🔵 Fetch all users endpoint called");

  try {
    await connectDB();
    console.log("✅ Database connected");

    // Get JWT token to verify admin access (supports NextAuth cookie + Bearer token)
    const token = await getAuthToken(req);
    console.log("🔵 Token received:", { userId: token?.userId || token?.sub, role: token?.role });

    // Allow both admin and bloodbank_admin roles
    if (!token || (token.role !== "admin" && token.role !== "bloodbank_admin")) {
      console.log("❌ Unauthorized: User is not admin. Token role:", token?.role);
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    // Fetch all users
    console.log("🔵 Fetching all users...");
    const users = await User.find({}).select("-password").sort({ createdAt: -1 });
    console.log("✅ Users fetched:", users.length);

    // Enrich user data with role-specific information
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const userData = {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          bloodType: null,
          status: mapVerificationStatus(user.verification_status),
          verification_status: user.verification_status,
          createdAt: user.createdAt,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`,
        };

        try {
          // If user is a donor, fetch blood type
          if (user.role === "user") {
            const donor = await Donor.findOne({ user_id: user._id });
            if (donor) {
              userData.bloodType = donor.blood_type;
            }
          }

          // If user is a hospital, fetch hospital info
          if (user.role === "hospital") {
            const hospital = await HospitalProfile.findOne({ user_id: user._id });
            if (hospital) {
              userData.hospitalName = hospital.name;
            }
          }
        } catch (err) {
          console.warn(`⚠️ Error enriching user ${user._id}:`, err.message);
        }

        return userData;
      })
    );

    console.log("✅ All users enriched successfully");

    return NextResponse.json(
      { users: enrichedUsers },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    console.error("❌ Error stack:", error.stack);
    return NextResponse.json(
      { error: "Failed to fetch users", details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to map verification status to display status
function mapVerificationStatus(verification_status) {
  if (verification_status === "VERIFIED") return "active";
  if (verification_status === "REJECTED") return "banned";
  if (verification_status === "PENDING") return "pending";
  return "pending";
}
