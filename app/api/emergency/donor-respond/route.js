import connectDB from '@/db/connectDB.mjs';
import HospitalRequest from '@/models/HospitalRequest.js';
import User from '@/models/User.js';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/authOptions.js';

export async function PATCH(req) {
  try {
    await connectDB();
    
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Only donors (users) can respond to emergency requests
    const user = await User.findById(session.user.id);
    if (!user || user.role !== 'user') {
      return NextResponse.json({ error: 'Only donors can respond to emergency requests' }, { status: 403 });
    }

    const { requestId } = await req.json();
    
    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 });
    }

    const hospitalRequest = await HospitalRequest.findById(requestId);

    if (!hospitalRequest) {
      return NextResponse.json({ error: 'Hospital request not found' }, { status: 404 });
    }

    if (!hospitalRequest.is_emergency) {
      return NextResponse.json({ error: 'This is not an emergency request' }, { status: 400 });
    }

    // Check if donor already responded
    const alreadyResponded = hospitalRequest.responders?.some(
      r => r.donorId.toString() === session.user.id
    );

    if (alreadyResponded) {
      return NextResponse.json({ 
        success: true,
        message: 'You have already responded to this emergency request',
        donorCount: hospitalRequest.responders.length
      }, { status: 200 });
    }

    // Add donor to responders array
    hospitalRequest.responders.push({
      donorId: session.user.id,
      respondedAt: new Date()
    });

    await hospitalRequest.save();

    console.log(`✅ Donor ${session.user.id} responded to emergency request ${requestId}`);
    console.log(`   Total responders: ${hospitalRequest.responders.length}`);

    return NextResponse.json({
      success: true,
      message: 'Your response has been recorded successfully',
      donorCount: hospitalRequest.responders.length
    }, { status: 200 });

  } catch (error) {
    console.error('Error in donor response:', error);
    return NextResponse.json(
      { error: 'Failed to record donor response', details: error.message },
      { status: 500 }
    );
  }
}
