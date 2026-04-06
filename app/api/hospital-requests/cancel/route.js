import connectDB from '@/db/connectDB.mjs';
import HospitalRequest from '@/models/HospitalRequest.js';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/authOptions.js';

// PATCH - Cancel a hospital request
export async function PATCH(req) {
  try {
    await connectDB();

    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'hospital') {
      console.error('❌ Unauthorized: No session or not a hospital user');
      return NextResponse.json(
        { error: 'Only hospital users can cancel requests' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    console.log('🔍 Cancel request params - ID:', id);
    
    if (!id) {
      console.error('❌ No ID provided in query params');
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
      );
    }

    // Find the request
    const request = await HospitalRequest.findById(id);
    if (!request) {
      console.error('❌ Request not found - ID:', id);
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    console.log('✅ Found request:', request._id, 'Status:', request.status);

    // Verify that the hospital owns this request
    if (request.hospital_id.toString() !== session.user.id) {
      console.error('❌ Hospital ownership mismatch. Request hospital:', request.hospital_id, 'Session user:', session.user.id);
      return NextResponse.json(
        { error: 'You can only cancel your own requests' },
        { status: 403 }
      );
    }

    // SECURITY: Block cancellation if request is in auto_routing status
    if (request.status === 'auto_routing') {
      console.error('❌ Cannot cancel - request in auto_routing status');
      return NextResponse.json(
        { error: 'Cannot cancel request while emergency auto-routing is active' },
        { status: 403 }
      );
    }

    // Only allow cancelling requests with 'pending' status
    if (request.status !== 'pending') {
      console.error('❌ Cannot cancel - current status:', request.status);
      return NextResponse.json(
        { error: `Cannot cancel requests with status: ${request.status}` },
        { status: 400 }
      );
    }

    // Update status to 'cancelled'
    request.status = 'cancelled';
    request.updated_at = new Date();
    await request.save();

    console.log('✅ Request cancelled successfully:', request._id);

    return NextResponse.json(
      {
        success: true,
        message: 'Request cancelled successfully',
        request: {
          _id: request._id,
          status: request.status,
          updated_at: request.updated_at
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Error cancelling request:', error);
    return NextResponse.json(
      { 
        error: 'Failed to cancel request',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
