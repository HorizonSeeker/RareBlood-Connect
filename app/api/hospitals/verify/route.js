import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import HospitalProfile from "@/models/HospitalProfile.js";
import { authenticateRole } from "@/lib/roleAuth";

export async function POST(req) {
  try {
    const auth = await authenticateRole(req, ['hospital']);
    if (!auth.success) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    await connectDB();
    const user = auth.user;
    const data = await req.json();
    const { documents } = data; // array of { name, url }

    const profile = await HospitalProfile.findOne({ user_id: user._id });
    if (!profile) {
      return Response.json({ error: 'Hospital profile not found' }, { status: 404 });
    }

    if (documents && Array.isArray(documents) && documents.length > 0) {
      profile.verification_documents = documents;
    }

    profile.verification_status = 'pending';
    profile.verification_requested_at = new Date();

    await profile.save();

    return Response.json({ success: true, message: 'Verification request submitted', profileId: profile._id });
  } catch (error) {
    console.error("Error submitting verification:", error);
    return Response.json({ error: 'Failed to submit verification', details: error.message }, { status: 500 });
  }
}
