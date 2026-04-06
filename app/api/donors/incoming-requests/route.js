import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/authMiddleware";
import connectDB from "@/db/connectDB.mjs";
import Donor from "@/models/Doner.js";
import DonorContactRequest from "@/models/DonorContactRequest.js";
import HospitalRequest from "@/models/HospitalRequest.js";
import User from "@/models/User.js";

export async function GET(req) {
  try {
    await connectDB();
    
    // Get the JWT token to identify the current user
    const token = await getAuthToken(req);
    
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Please login or provide Bearer token" },
        { status: 401 }
      );
    }

    // Find the donor profile for this user
    const donor = await Donor.findOne({ user_id: token.userId || token.sub });
    
    if (!donor) {
      return NextResponse.json(
        { error: "Donor profile not found" },
        { status: 404 }
      );
    }

    console.log("🔵 Fetching requests for donor:", donor._id);

    // Fetch DonorContactRequests made to this specific donor grouped by status
    const [pendingRequests, acceptedRequests, rejectedRequests] = await Promise.all([
      DonorContactRequest.find({
        donorId: donor._id,
        status: 'pending',
        expiresAt: { $gt: new Date() } // Only non-expired requests
      })
      .populate('requesterId', 'name email role')
      .populate('requestId', 'blood_type units_requested emergency_details hospital_location patient_name')
      .sort({ requestDate: -1 })
      .lean(),
      
      DonorContactRequest.find({
        donorId: donor._id,
        status: 'accepted'
      })
      .populate('requesterId', 'name email role')
      .populate('requestId', 'blood_type units_requested emergency_details hospital_location patient_name')
      .sort({ responseDate: -1 })
      .lean(),
      
      DonorContactRequest.find({
        donorId: donor._id,
        status: 'rejected'
      })
      .populate('requesterId', 'name email role')
      .populate('requestId', 'blood_type units_requested emergency_details hospital_location patient_name')
      .sort({ responseDate: -1 })
      .lean()
    ]);

    console.log("🔵 Found requests - Pending:", pendingRequests.length, "Accepted:", acceptedRequests.length, "Rejected:", rejectedRequests.length);

    // Transform function for requests
    const transformRequest = (request) => {
      console.log("📋 Request data:", {
        id: request._id,
        type: request.requestType,
        requestId: request.requestId?._id,
        hospital_location: request.requestId?.hospital_location,
        blood_type: request.bloodType
      });
      
      return {
        _id: request._id,
        type: 'donor_contact_request',
        requestType: request.requestType || 'CONTACT', // 'CONTACT' or 'EMERGENCY'
        blood_type: request.bloodType,
        urgency: request.urgencyLevel?.toLowerCase() || 'medium',
        message: request.message,
        requester_name: request.requesterId?.name,
        requester_email: request.requesterId?.email,
        requester_role: request.requesterId?.role,
        contact_email: request.requesterId?.email,
        units_requested: request.requestId?.units_requested || 0, // Get from HospitalRequest
        emergency_details: request.requestId?.emergency_details,
        hospital_location: request.requestId?.hospital_location,
        patient_name: request.requestId?.patient_name,
        created_at: request.requestDate,
        expires_at: request.expiresAt,
        responded_at: request.responseDate,
        status: request.status,
        distance: 0 // Not applicable for direct requests
      };
    };

    const transformedPending = pendingRequests.map(transformRequest);
    const transformedAccepted = acceptedRequests.map(transformRequest);
    const transformedRejected = rejectedRequests.map(transformRequest);

    console.log("✅ Transformed requests - Pending:", transformedPending.length, "Accepted:", transformedAccepted.length, "Rejected:", transformedRejected.length);

    return NextResponse.json({
      success: true,
      requests: transformedPending, // For backwards compatibility
      pendingRequests: transformedPending,
      acceptedRequests: transformedAccepted,
      rejectedRequests: transformedRejected
    });

  } catch (error) {
    console.error("❌ Error fetching incoming requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch incoming requests", details: error.message },
      { status: 500 }
    );
  }
}