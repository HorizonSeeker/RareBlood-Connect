import connectDB from '@/db/connectDB.mjs';
import HospitalRequest from '@/models/HospitalRequest.js';
import User from '@/models/User.js';
import { NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/authMiddleware';

/**
 * POST /api/hospital-requests/confirm-donor
 * 
 * When a donor confirms they will donate (from SOS notification),
 * add them to the responders array and broadcast update via Pusher
 * 
 * Request body:
 * {
 *   "hospital_request_id": "...",
 *   "donor_id": "..."
 * }
 */
export async function POST(req) {
  try {
    await connectDB();

    const token = await getAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - Please login or provide Bearer token' }, { status: 401 });
    }

    const donorId = token.userId || token.sub;
    
    // Verify user is a donor
    const user = await User.findById(donorId);
    if (!user || user.role !== 'user') {
      return NextResponse.json({ error: 'Access denied. Donor role required.' }, { status: 403 });
    }

    const data = await req.json();
    const { hospital_request_id } = data;

    if (!hospital_request_id) {
      return NextResponse.json({ error: 'Hospital request ID is required' }, { status: 400 });
    }

    // Find the hospital request
    const hospitalRequest = await HospitalRequest.findById(hospital_request_id)
      .populate('hospital_id', 'name email')
      .populate('responders.donorId', 'name email');

    if (!hospitalRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Check if request is in auto_routing status
    if (hospitalRequest.status !== 'auto_routing') {
      return NextResponse.json({ 
        error: 'Request is not in auto-routing status' 
      }, { status: 400 });
    }

    // Check if donor already responded
    const alreadyResponded = hospitalRequest.responders.some(
      responder => responder.donorId.toString() === donorId
    );

    if (alreadyResponded) {
      return NextResponse.json({ 
        error: 'You have already confirmed your donation for this request',
        responders_count: hospitalRequest.responders.length
      }, { status: 400 });
    }

    // Add donor to responders array
    hospitalRequest.responders.push({
      donorId: donorId,
      respondedAt: new Date()
    });

    await hospitalRequest.save();
    
    // Repopulate after save
    await hospitalRequest.populate('responders.donorId', 'name email');

    console.log(`✅ Donor ${donorId} confirmed donation for request ${hospital_request_id}`);
    console.log(`📊 Total responders: ${hospitalRequest.responders.length}`);

    // Trigger Pusher event for real-time update (non-blocking)
    setImmediate(async () => {
      try {
        const PusherModule = await import('pusher');
        const Pusher = PusherModule.default;
        
        const pusher = new Pusher({
          appId: process.env.NEXT_PUBLIC_PUSHER_APP_ID,
          key: process.env.NEXT_PUBLIC_PUSHER_KEY,
          secret: process.env.PUSHER_SECRET,
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
          useTLS: true
        });

        console.log('📤 Broadcasting sos-response-update via Pusher...');
        
        // Broadcast to hospital dashboard
        await pusher.trigger('blood-channel', 'sos-response-update', {
          hospital_request_id: hospitalRequest._id,
          donor_id: donorId,
          donor_name: user.name,
          responders_count: hospitalRequest.responders.length,
          message: `✅ ${user.name} confirmed donation. Total: ${hospitalRequest.responders.length} donors heading to hospital.`,
          timestamp: new Date(),
          responders: hospitalRequest.responders.map(r => ({
            donorId: r.donorId._id,
            name: r.donorId.name,
            respondedAt: r.respondedAt
          }))
        });

        console.log('✅ Pusher event sent successfully');
      } catch (err) {
        console.error('❌ Pusher trigger error:', err);
        // Non-blocking, so error is logged but doesn't affect response
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Donation confirmation recorded',
      responders_count: hospitalRequest.responders.length,
      request: {
        _id: hospitalRequest._id,
        status: hospitalRequest.status,
        responders_count: hospitalRequest.responders.length,
        responders: hospitalRequest.responders.map(r => ({
          donorId: r.donorId._id,
          name: r.donorId.name,
          respondedAt: r.respondedAt
        }))
      }
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Error confirming donor response:', error);
    return NextResponse.json({ 
      error: 'Failed to confirm donation',
      details: error.message 
    }, { status: 500 });
  }
}
