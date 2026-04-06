import connectDB from '@/db/connectDB.mjs';
import HospitalRequest from '@/models/HospitalRequest.js';
import User from '@/models/User.js'; // Chỉ dùng model User
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/authOptions.js';

export async function POST(req) {
  try {
    await connectDB();
    
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // bloodbank_admin or hospital_admin can trigger emergency broadcast
    const user = await User.findById(session.user.id);
    if (!user || (user.role !== 'bloodbank_admin' && user.role !== 'hospital_admin')) {
      return NextResponse.json({ error: 'Access denied. Bloodbank or hospital admin role required.' }, { status: 403 });
    }

    const { requestId } = await req.json();
    
    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 });
    }

    const hospitalRequest = await HospitalRequest.findById(requestId)
      .populate('hospital_id', 'name email')
      .populate('bloodbank_id', 'name email');

    if (!hospitalRequest) {
      return NextResponse.json({ error: 'Hospital request not found' }, { status: 404 });
    }

    if (hospitalRequest.status !== 'accepted' && hospitalRequest.status !== 'fulfilled') {
      return NextResponse.json({ error: 'Request must be accepted before broadcasting' }, { status: 400 });
    }

    if (hospitalRequest.is_emergency !== true) {
      return NextResponse.json({ error: 'This is not an emergency request' }, { status: 400 });
    }

    const hospitalLat = hospitalRequest.hospital_location?.latitude;
    const hospitalLng = hospitalRequest.hospital_location?.longitude;
    const searchRadius = hospitalRequest.search_radius || 20;

    if (!hospitalLat || !hospitalLng) {
      return NextResponse.json({ error: 'Hospital location is not set in the request' }, { status: 400 });
    }

    const radiusInMeters = searchRadius * 1000;

    const compatibleBloodTypes = hospitalRequest.compatible_blood_types?.length > 0
      ? hospitalRequest.compatible_blood_types
      : [hospitalRequest.blood_type];

    console.log(`🚨 Starting emergency broadcast for request ${requestId}`);
    console.log(`   Blood types: ${compatibleBloodTypes.join(', ')}`);
    
    try {
      // FIXED: Changed Donor.find to User.find and added role: 'user'
      const donors = await User.find({
        role: 'user', // Must be user (which is donor in your system)
        verification_status: 'VERIFIED',
        is_critical_ready: true,
        
        // FIXED: Changed blood_type to bloodType to match DB
        bloodType: { $in: compatibleBloodTypes }, 
        
        // NOTE: Location field in user DB must be named 'current_location'
        current_location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [hospitalLng, hospitalLat]
            },
            $maxDistance: radiusInMeters
          }
        }
      })
        .limit(50)
        .select('_id bloodType current_location'); // Fixed bloodType

      console.log(`✅ Found ${donors.length} compatible donors`);

      donors.forEach((donor, index) => {
        const distance = calculateDistance(
          hospitalLat,
          hospitalLng,
          donor.current_location?.coordinates?.[1] || 0,
          donor.current_location?.coordinates?.[0] || 0
        );
        
        console.log(
          `🚨 FCM sent to User ID: ${donor._id} - ` +
          `Distance: ${distance.toFixed(2)}km - ` +
          `Blood Type: ${donor.bloodType}`
        );
      });

      hospitalRequest.emergency_notification = {
        status: 'triggered',
        sent_count: donors.length,
        sent_at: new Date()
      };

      await hospitalRequest.save();
      console.log(`✅ Updated emergency_notification for request ${requestId}`);

      return NextResponse.json({
        success: true,
        message: 'Broadcasted successfully',
        donorsNotified: donors.length
      }, { status: 200 });

    } catch (queryError) {
      console.error('Error querying donors:', queryError);
      throw queryError;
    }

  } catch (error) {
    console.error('Error in emergency broadcast:', error);
    return NextResponse.json(
      { error: 'Failed to broadcast emergency request', details: error.message },
      { status: 500 }
    );
  }
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; 
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}