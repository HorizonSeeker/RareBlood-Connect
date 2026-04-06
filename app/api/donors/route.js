import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import Doner from "@/models/Doner.js";
import User from "@/models/User.js";
import BloodBank from "@/models/BloodBank.js";
import { getServerSession } from "next-auth";

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// GET - Find donors based on criteria
export async function GET(req) {
  try {
    console.log("Donors API called - Starting...");
    
    const session = await getServerSession();
    console.log("Session:", session ? "Found" : "Not found");
    
    await connectDB();
    console.log("Database connected");

    // Try to get current user if session exists (optional) — used only for bloodbank-specific filtering
    let currentUser = null;
    if (session?.user?.email) {
      currentUser = await User.findOne({ email: session.user.email });
      console.log("Current user found:", currentUser ? "Yes" : "No");
      console.log("User role:", currentUser?.role);
    } else {
      console.log("No session/email available - proceeding as public request");
    }

    // Get blood bank location (only if requester is a bloodbank admin)
    let bloodBank = null;
    if (currentUser && currentUser.role === 'bloodbank_admin') {
      bloodBank = await BloodBank.findOne({ user_id: currentUser._id });
      console.log("Blood bank found:", bloodBank ? "Yes" : "No");
      console.log("Blood bank location:", bloodBank?.location);
    } else {
      console.log("Requester is not a bloodbank admin (or not logged in) - skipping blood bank lookup");
    }
    
    // If no blood bank found or no location, return donors without distance filtering
    let bloodBankLat, bloodBankLng;
    let useDistanceFilter = false;
    
    if (bloodBank && bloodBank.location && bloodBank.location.coordinates && 
        Array.isArray(bloodBank.location.coordinates) && bloodBank.location.coordinates.length === 2) {
      [bloodBankLng, bloodBankLat] = bloodBank.location.coordinates;
      useDistanceFilter = true;
      console.log("Using distance filter with coordinates:", bloodBankLat, bloodBankLng);
    } else {
      console.log("No valid blood bank location found - skipping distance filter");
    }

    const { searchParams } = new URL(req.url);
    const maxDistance = parseFloat(searchParams.get("maxDistance")) || 50;
    const criticalOnly = searchParams.get("criticalOnly") === "true";
    const bloodType = searchParams.get("bloodType");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    console.log("Query params:", { maxDistance, criticalOnly, bloodType, status, search });

    // Build query
    let query = {};
    
    if (criticalOnly) {
      query.is_critical_ready = true;
    }
    
    if (bloodType) {
      query.blood_type = bloodType;
    }

    if (status) {
      query.status = status;
    }

    // Only require location data if we're using distance filtering
    if (useDistanceFilter) {
      query.current_location = { $exists: true, $ne: null };
    }

    console.log("MongoDB query:", query);

    // ✅ FIX: Add result limit to prevent performance issues with large datasets
    const donors = await Doner.find(query)
      .populate('user_id', 'name email')
      .sort({ created_at: -1 })
      .limit(1000)  // Prevent returning thousands of documents
      .lean();      // Use lean() for better performance

    console.log("Found donors count:", donors.length);

    let processedDonors = donors;

    // Apply distance filtering only if we have blood bank location
    if (useDistanceFilter) {
      const donorsWithDistance = donors
        .map(donor => {
          if (!donor.current_location || !donor.current_location.coordinates) {
            return null;
          }
          
          const [donorLng, donorLat] = donor.current_location.coordinates;
          const distance = calculateDistance(bloodBankLat, bloodBankLng, donorLat, donorLng);
          
          return {
            ...donor,
            distance: Math.round(distance * 10) / 10
          };
        })
        .filter(donor => donor !== null && donor.distance <= maxDistance);

      processedDonors = donorsWithDistance;
      console.log("Donors within distance:", processedDonors.length);
    } else {
      // If no distance filtering, add a default distance or null
      processedDonors = donors.map(donor => ({
        ...donor,
        distance: null
      }));
    }

    // Apply search filter if provided
    let filteredDonors = processedDonors;
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filteredDonors = processedDonors.filter(donor => {
        const user = donor.user_id;
        return (
          searchRegex.test(user?.name || '') ||
          searchRegex.test(user?.email || '') ||
          searchRegex.test(donor.mobile_number || '') ||
          searchRegex.test(donor.address || '')
        );
      });
    }

    // Sort by distance (closest first) if distance filtering is enabled
    if (useDistanceFilter) {
      filteredDonors.sort((a, b) => a.distance - b.distance);
    }

    // Transform data for frontend
    const transformedDonors = filteredDonors.map(donor => ({
      _id: donor._id,
      name: donor.user_id?.name || 'Unknown',
      email: donor.user_id?.email || 'No email',
      mobile_number: donor.mobile_number || 'No phone',
      blood_type: donor.blood_type,
      age: donor.age,
      address: donor.address || 'No address provided',
      last_donation_date: donor.last_donation_date || new Date('2024-01-01'),
      total_donations: donor.total_donations || 0,
      status: donor.status || 'Active',
      is_critical_ready: donor.is_critical_ready || false,
      distance: donor.distance,
      coordinates: donor.current_location?.coordinates || null,
      created_at: donor.created_at,
      updated_at: donor.updated_at
    }));

    console.log("Final transformed donors count:", transformedDonors.length);

    const response = {
      success: true,
      donors: transformedDonors,
      total: transformedDonors.length,
      bloodBankLocation: useDistanceFilter ? {
        latitude: bloodBankLat,
        longitude: bloodBankLng,
        name: bloodBank?.name || 'Blood Bank'
      } : null,
      filters: {
        maxDistance,
        criticalOnly,
        bloodType,
        status,
        search,
        distanceFilterEnabled: useDistanceFilter
      }
    };

    console.log("Returning response with donors:", response.total);
    return NextResponse.json(response);

  } catch (error) {
    console.error("Error in donors API:", error);
    console.error("Error stack:", error.stack);
    return NextResponse.json(
      { error: "Failed to fetch donors: " + error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new donor
export async function POST(request) {
  try {
    await connectDB();
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const data = await request.json();
    
    // ✅ FIX: Ensure user_id is set to current user
    let userId = data.user_id;
    if (!userId) {
      const currentUser = await User.findOne({ email: session.user.email });
      if (currentUser) {
        userId = currentUser._id;
        data.user_id = userId;
      }
    }
    
    // Create new donor
    const newDonor = new Doner(data);
    await newDonor.save();
    
    // Note: User role remains 'user' (not 'donor' - that role doesn't exist)
    // Donor is identified by having a Doner profile, not by role
    
    return NextResponse.json({
      success: true,
      donor: newDonor,
      message: 'Donor profile created successfully'
    });

  } catch (error) {
    console.error('Error creating donor:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}