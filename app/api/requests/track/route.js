import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/authMiddleware";
import connectDB from "@/db/connectDB.mjs";
import BloodRequest from "@/models/BloodRequest.js";
import User from "@/models/User.js";
import BloodBank from "@/models/BloodBank.js";

export async function GET(req) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const id = searchParams.get("id");
    const userOnly = searchParams.get("userOnly") === "true"; // Flag to get only user's requests
    const checkEmergency = searchParams.get("checkEmergency") === "true"; // Flag to check if user has emergency requests
    
    // Get JWT token to check if user is authenticated
    const token = await getAuthToken(req);
    
    // If userOnly is true, get requests based on user's email (from their account)
    if (userOnly && token) {
      const user = await User.findById(token.userId || token.sub);
      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      // Get all requests made with this user's email address
      const userRequests = await BloodRequest.find({
        $or: [
          { requested_by_user: user._id },
          { requested_by_hospital: user._id },
          { emergency_requester_email: user.email }
        ]
      })
      .populate('requested_by_user', 'name email mobile_number')
      .populate('requested_by_hospital', 'name email mobile_number')
      .populate('bloodbank_id', 'name address contact_number email')
      .sort({ requested_date: -1 });

      // Organize requests by status category
      const acceptedRequests = userRequests.filter(req => req.status === 'accepted');
      const activeRequests = userRequests.filter(req => 
        ['pending', 'auto_routing'].includes(req.status)
      );
      const completedRequests = userRequests.filter(req => req.status === 'completed');
      const rejectedRequests = userRequests.filter(req => req.status === 'rejected');
      
      // Determine primary display type
      if (acceptedRequests.length > 0) {
        return NextResponse.json({ 
          requests: acceptedRequests, 
          allRequests: userRequests,
          type: 'fulfilled',
          message: `Showing ${acceptedRequests.length} fulfilled request(s)`,
          breakdown: {
            accepted: acceptedRequests.length,
            active: activeRequests.length,
            completed: completedRequests.length,
            rejected: rejectedRequests.length
          }
        }, { status: 200 });
      } else if (activeRequests.length > 0) {
        return NextResponse.json({ 
          requests: activeRequests, 
          allRequests: userRequests,
          type: 'active',
          message: `Showing ${activeRequests.length} active request(s)`,
          breakdown: {
            accepted: acceptedRequests.length,
            active: activeRequests.length,
            completed: completedRequests.length,
            rejected: rejectedRequests.length
          }
        }, { status: 200 });
      } else {
        return NextResponse.json({ 
          requests: userRequests, 
          allRequests: userRequests,
          type: 'other',
          message: `Showing ${userRequests.length} request(s)`,
          breakdown: {
            accepted: acceptedRequests.length,
            active: activeRequests.length,
            completed: completedRequests.length,
            rejected: rejectedRequests.length
          }
        }, { status: 200 });
      }
    }

    // Quick emergency check for navbar
    if (checkEmergency && email) {
      const user = await User.findOne({ email: email.toLowerCase() });
      
      let emergencyQuery = {};
      if (user) {
        // User exists, check their requests
        emergencyQuery.$or = [
          { requested_by_user: user._id, request_type: 'emergency' },
          { requested_by_hospital: user._id, request_type: 'emergency' },
          { emergency_requester_email: email.toLowerCase(), request_type: 'emergency' }
        ];
      } else {
        // No user found, check emergency requests only
        emergencyQuery = {
          emergency_requester_email: email.toLowerCase(),
          request_type: 'emergency'
        };
      }
      
      const emergencyRequests = await BloodRequest.find(emergencyQuery);
      return NextResponse.json({ 
        requests: emergencyRequests,
        hasEmergencyRequests: emergencyRequests.length > 0
      }, { status: 200 });
    }
    
    // Search logic for manual email/ID search
    if (!email && !id) {
      return NextResponse.json(
        { error: "Email or request ID is required" },
        { status: 400 }
      );
    }

    let query = {};
    let searchByEmail = false;
    
    if (email) {
      searchByEmail = true;
      // Search by email - check both logged-in users and emergency requests
      const user = await User.findOne({ email: email.toLowerCase() });
      
      if (user) {
        // User exists, find their requests
        query.$or = [
          { requested_by_user: user._id },
          { requested_by_hospital: user._id },
          { emergency_requester_email: email.toLowerCase() }
        ];
      } else {
        // No user found, search by email field directly (more comprehensive)
        query.$or = [
          { emergency_requester_email: email.toLowerCase() },
          { 'requested_by_hospital.email': email.toLowerCase() }
        ];
      }
    } else if (id) {
      // Search by request ID - return single request
      query._id = id;
    }
    
    if (searchByEmail) {
      // For email search, get all requests for that email
      const allRequests = await BloodRequest.find(query)
        .populate('requested_by_user', 'name email mobile_number')
        .populate('requested_by_hospital', 'name email mobile_number')
        .populate('bloodbank_id', 'name address contact_number email')
        .sort({ requested_date: -1 });

      if (!allRequests || allRequests.length === 0) {
        // Return an empty result set with 200 so client auto-searches and navbar checks
        // don't see this as an error (prevents noisy 404s in logs)
        return NextResponse.json(
          { requests: [], type: 'none', message: 'No requests found for this email' },
          { status: 200 }
        );
      }

      // Organize requests by status category
      const acceptedRequests = allRequests.filter(req => req.status === 'accepted');
      const activeRequests = allRequests.filter(req => 
        ['pending', 'auto_routing'].includes(req.status)
      );
      const completedRequests = allRequests.filter(req => req.status === 'completed');
      const rejectedRequests = allRequests.filter(req => req.status === 'rejected');

      // Determine primary type and return appropriate data
      if (acceptedRequests.length > 0) {
        return NextResponse.json({ 
          requests: acceptedRequests,
          allRequests: allRequests,
          type: 'fulfilled',
          message: `Showing ${acceptedRequests.length} fulfilled request(s) for this email`,
          breakdown: {
            accepted: acceptedRequests.length,
            active: activeRequests.length,
            completed: completedRequests.length,
            rejected: rejectedRequests.length
          }
        }, { status: 200 });
      } else if (activeRequests.length > 0) {
        return NextResponse.json({ 
          requests: activeRequests,
          allRequests: allRequests,
          type: 'active',
          message: `Showing ${activeRequests.length} active request(s) for this email`,
          breakdown: {
            accepted: acceptedRequests.length,
            active: activeRequests.length,
            completed: completedRequests.length,
            rejected: rejectedRequests.length
          }
        }, { status: 200 });
      } else {
        return NextResponse.json({ 
          requests: allRequests,
          allRequests: allRequests,
          type: 'other',
          message: `Showing ${allRequests.length} request(s) for this email`,
          breakdown: {
            accepted: acceptedRequests.length,
            active: activeRequests.length,
            completed: completedRequests.length,
            rejected: rejectedRequests.length
          }
        }, { status: 200 });
      }
    } else {
      // For ID search, return single request
      const request = await BloodRequest.findOne(query)
        .populate('requested_by_user', 'name email mobile_number')
        .populate('requested_by_hospital', 'name email mobile_number')
        .populate('bloodbank_id', 'name address contact_number email')
        .sort({ requested_date: -1 });

      if (!request) {
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ request }, { status: 200 });
    }
  } catch (error) {
    console.error("Error tracking blood request:", error);
    return NextResponse.json(
      { error: "Failed to track blood request" },
      { status: 500 }
    );
  }
}
