import { NextResponse } from 'next/server';
import connectDB from '@/db/connectDB.mjs';
import Donor from '@/models/Doner.js';

/**
 * GET /api/donors/find-nearby
 * 
 * Find donors within a specified radius using MongoDB geospatial queries
 * 
 * Query Parameters:
 * - latitude (required): User's latitude
 * - longitude (required): User's longitude
 * - radius (optional): Search radius in kilometers (default: 10)
 * - blood_type (optional): Filter by blood type
 * - limit (optional): Max results (default: 20)
 */

export async function GET(request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const latitude = parseFloat(searchParams.get('latitude'));
    const longitude = parseFloat(searchParams.get('longitude'));
    const radius = parseFloat(searchParams.get('radius')) || 10; // Default 10 km
    const blood_type = searchParams.get('blood_type');
    const limit = parseInt(searchParams.get('limit')) || 20;
    const is_critical_ready = searchParams.get('is_critical_ready') === 'true';

    // Validate required parameters
    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: 'latitude and longitude are required and must be valid numbers' },
        { status: 400 }
      );
    }

    // Build geospatial query
    const query = {
      current_location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude] // [lon, lat] order for GeoJSON
          },
          $maxDistance: radius * 1000 // Convert km to meters
        }
      }
    };

    // Filter by blood type if provided
    if (blood_type) {
      query.blood_type = blood_type;
    }

    // Filter by critical readiness if specified
    if (is_critical_ready) {
      query.is_critical_ready = true;
    }

    // Execute geospatial query with distance calculation
    const donors = await Donor.find(query)
      .select('user_id blood_type mobile_number weight is_critical_ready current_location total_donations accepted_requests')
      .populate('user_id', 'name email')
      .limit(limit)
      .lean();

    // Filter out donors with null user_id (users that don't exist)
    const validDonors = donors.filter(donor => donor.user_id !== null);

    // Calculate distances for each donor and format response
    const donorsWithDistance = validDonors.map(donor => {
      const distance = calculateDistance(
        latitude,
        longitude,
        donor.current_location.coordinates[1], // latitude
        donor.current_location.coordinates[0]  // longitude
      );

      return {
        _id: donor._id,
        user_id: donor.user_id._id,
        name: donor.user_id?.name || 'Unknown Donor',
        email: donor.user_id?.email || 'No email',
        blood_type: donor.blood_type,
        mobile_number: donor.mobile_number,
        weight: donor.weight,
        is_critical_ready: donor.is_critical_ready,
        location: {
          type: donor.current_location.type,
          coordinates: donor.current_location.coordinates
        },
        distance_km: Math.round(distance * 10) / 10, // Round to 1 decimal
        total_donations: donor.total_donations,
        accepted_requests: donor.accepted_requests
      };
    });

    return NextResponse.json({
      success: true,
      count: donorsWithDistance.length,
      search_params: {
        center: { latitude, longitude },
        radius_km: radius,
        blood_type: blood_type || 'all',
        is_critical_ready: is_critical_ready
      },
      donors: donorsWithDistance
    });

  } catch (error) {
    console.error('❌ Error finding nearby donors:', error);
    return NextResponse.json(
      { error: 'Failed to find nearby donors', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
}
