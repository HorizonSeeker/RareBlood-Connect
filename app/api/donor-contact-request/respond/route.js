import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import DonorContactRequest from '@/models/DonorContactRequest.js';
import User from '@/models/User.js';
import Doner from '@/models/Doner.js';
import connectDB from '@/db/connectDB';

export async function PATCH(request) {
  try {
    await connectDB();
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { requestId, action } = await request.json(); // action: 'accept' or 'reject'

    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    // Get user details
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get donor profile
    const donor = await Doner.findOne({ user_id: user._id });
    if (!donor) {
      return NextResponse.json(
        { error: 'Donor profile not found' },
        { status: 404 }
      );
    }

    // Find and update the request
    const contactRequest = await DonorContactRequest.findOne({
      _id: requestId,
      donorId: donor._id,
      status: 'pending'
    });

    if (!contactRequest) {
      return NextResponse.json(
        { error: 'Request not found or already responded' },
        { status: 404 }
      );
    }

    contactRequest.status = action === 'accept' ? 'accepted' : 'rejected';
    contactRequest.responseDate = new Date();
    
    await contactRequest.save();

    // Trigger Pusher event (non-blocking)
    (async () => {
      try {
        const PusherModule = await import('pusher');
        const Pusher = PusherModule.default || PusherModule;
        const pusher = new Pusher({
          appId: process.env.PUSHER_APP_ID,
          key: process.env.NEXT_PUBLIC_PUSHER_KEY,
          secret: process.env.PUSHER_SECRET,
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
          useTLS: true,
        });

        await pusher.trigger('blood-channel', 'request:response', {
          requestId: contactRequest._id,
          status: contactRequest.status,
          donorId: donor._id,
          responded_at: contactRequest.responseDate,
          message: `Request has been ${contactRequest.status}`
        });
      } catch (err) {
        console.error('Pusher trigger error (non-blocking):', err);
      }
    })();

    return NextResponse.json({
      message: `Request ${action}ed successfully`,
      request: contactRequest
    });

  } catch (error) {
    console.error('Error responding to donor contact request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}