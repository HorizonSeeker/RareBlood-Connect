import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import HospitalProfile from "@/models/HospitalProfile.js";
import User from "@/models/User.js";
import { getAuthToken } from "@/lib/authMiddleware";

export async function GET(req) {
  try {
    console.log("🔵 [Hospitals/Verify] GET - Fetching pending hospitals");
    
    // Use getAuthToken which supports BOTH NextAuth cookies AND Bearer tokens
    const token = await getAuthToken(req);
    if (!token) {
      console.error("❌ [Hospitals/Verify] No valid token found");
      return NextResponse.json({ error: "Unauthorized - No valid session" }, { status: 401 });
    }

    // Check if user is admin
    if (token.role !== "admin") {
      console.error("❌ [Hospitals/Verify] User is not admin, role:", token.role);
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    console.log("✅ [Hospitals/Verify] User authenticated as admin:", token.email);

    await connectDB();
    const pending = await HospitalProfile.find({ verification_status: 'pending' })
      .populate('user_id', 'email name')
      .sort({ createdAt: -1 });
    
    console.log("✅ [Hospitals/Verify] Fetched pending hospitals:", pending.length);
    return NextResponse.json({ pending });
  } catch (error) {
    console.error("❌ [Hospitals/Verify] Error fetching pending verifications:", error);
    return NextResponse.json({ error: 'Failed to fetch pending verifications', details: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    console.log("🔵 [Hospitals/Verify] POST - Processing verification action");
    
    // Use getAuthToken which supports BOTH NextAuth cookies AND Bearer tokens
    const token = await getAuthToken(req);
    if (!token) {
      console.error("❌ [Hospitals/Verify] No valid token found");
      return NextResponse.json({ error: "Unauthorized - No valid session" }, { status: 401 });
    }

    // Check if user is admin
    if (token.role !== "admin") {
      console.error("❌ [Hospitals/Verify] User is not admin, role:", token.role);
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    console.log("✅ [Hospitals/Verify] User authenticated as admin:", token.email);

    await connectDB();
    const body = await req.json();
    const { profileId, action, notes } = body;

    if (!profileId || !['approve','reject'].includes(action)) {
      return NextResponse.json({ error: 'profileId and valid action (approve|reject) are required' }, { status: 400 });
    }

    const profile = await HospitalProfile.findById(profileId);
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    if (action === 'approve') {
      profile.verification_status = 'verified';
      profile.verified_by = token.userId || token.sub;
      profile.verified_at = new Date();
      profile.verification_notes = notes || '';
      await profile.save();

      console.log(`✅ Hospital profile ${profileId} approved by ${token.email}`);
      return NextResponse.json({ success: true, message: 'Hospital verified' });
    } else {
      profile.verification_status = 'rejected';
      profile.verification_notes = notes || '';
      await profile.save();

      console.log(`✅ Hospital profile ${profileId} rejected by ${token.email}`);
      return NextResponse.json({ success: true, message: 'Hospital verification rejected' });
    }
  } catch (error) {
    console.error("❌ [Hospitals/Verify] Error processing verification action:", error);
    return NextResponse.json({ error: 'Failed to process action', details: error.message }, { status: 500 });
  }
}
