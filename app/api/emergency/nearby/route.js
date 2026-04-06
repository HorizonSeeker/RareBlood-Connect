import { NextResponse } from 'next/server';
import connectDB from '@/db/connectDB.mjs';
import BloodRequest from '@/models/BloodRequest.js';
import Donor from '@/models/Doner.js';
import User from '@/models/User.js';
import HospitalProfile from '@/models/HospitalProfile.js';
import { getAuthToken } from '@/lib/authMiddleware';

const MAX_DISTANCE_KM = 20;

// Haversine formula to calculate distance between two coordinates
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export async function GET(req) {
  try {
    await connectDB();

    // ====== 1. GET AUTHENTICATED DONOR ======
    const token = await getAuthToken(req);
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login or provide Bearer token' },
        { status: 401 }
      );
    }
    if (token.role !== 'user') {
      return NextResponse.json(
        { error: "Unauthorized - Only donors can view active SOS requests" },
        { status: 403 }
      );
    }

    const currentUser = await User.findById(token.userId || token.sub);
    if (!currentUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const donor = await Donor.findOne({ user_id: currentUser._id });
    if (!donor) {
      return NextResponse.json(
        { error: "Donor profile not found" },
        { status: 404 }
      );
    }

    // Check if donor is ready for emergencies
    if (!donor.is_critical_ready) {
      return NextResponse.json({
        success: true,
        emergencyRequests: [],
        message: "Donor not ready for emergency donations"
      });
    }

    // ====== 2. GET DONOR LOCATION ======
    const [donorLon, donorLat] = donor.current_location?.coordinates || [0, 0];

    // ====== 3. FETCH ACTIVE EMERGENCY REQUESTS ======
    const activeRequests = await BloodRequest.find({
      status: 'active',
      emergency: true
    }).populate('hospital_id', 'name phone email');

    // ====== 4. FILTER BY DISTANCE & BLOOD TYPE COMPATIBILITY ======
    const compatibleBloodTypes = getCompatibleRecipientBlood(donor.blood_type);
    
    const nearbyEmergencies = [];

    for (const request of activeRequests) {
      // Check blood type compatibility
      if (!compatibleBloodTypes.includes(request.blood_type)) {
        continue;
      }

      // Get hospital location
      const hospital = await HospitalProfile.findById(request.hospital_id);
      if (!hospital?.location?.coordinates) {
        continue;
      }

      const [hospitalLon, hospitalLat] = hospital.location.coordinates;
      const distance = calculateDistance(donorLat, donorLon, hospitalLat, hospitalLon);

      // Filter by distance
      if (distance > MAX_DISTANCE_KM) {
        continue;
      }

      // Check if donor already confirmed this request
      const alreadyConfirmed = request.confirmed_donors?.includes(donor._id);
      if (alreadyConfirmed) {
        continue;
      }

      nearbyEmergencies.push({
        _id: request._id,
        blood_type: request.blood_type,
        units_required: request.units_required,
        units_fulfilled: request.units_fulfilled || 0,
        hospital_name: hospital.name,
        contact_number: request.contact_number,
        distance_km: distance,
        createdAt: request.createdAt,
        status: request.status
      });
    }

    // Sort by units needed (highest first) and then by distance (closest first)
    nearbyEmergencies.sort((a, b) => {
      const aUnitsLeft = a.units_required - a.units_fulfilled;
      const bUnitsLeft = b.units_required - b.units_fulfilled;
      if (aUnitsLeft !== bUnitsLeft) {
        return bUnitsLeft - aUnitsLeft;
      }
      return a.distance_km - b.distance_km;
    });

    return NextResponse.json({
      success: true,
      emergencyRequests: nearbyEmergencies,
      totalNearby: nearbyEmergencies.length
    });

  } catch (error) {
    console.error('Error fetching nearby emergency requests:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to get compatible recipient blood types
const getCompatibleRecipientBlood = (donorBloodType) => {
  const compatibility = {
    'O+': ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'],
    'O-': ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'],
    'A+': ['A+', 'AB+', 'A-', 'AB-'],
    'A-': ['A+', 'AB+', 'A-', 'AB-'],
    'B+': ['B+', 'AB+', 'B-', 'AB-'],
    'B-': ['B+', 'AB+', 'B-', 'AB-'],
    'AB+': ['AB+', 'AB-'],
    'AB-': ['AB+', 'AB-']
  };
  return compatibility[donorBloodType] || [];
};
