import { NextResponse } from 'next/server';
import connectDB from '@/db/connectDB.mjs';
import User from '@/models/User.js';
import Donor from '@/models/Doner.js';

export async function PUT(request) {
  try {
    await connectDB();
    const { userId, fcmToken } = await request.json();

    if (!userId || !fcmToken) {
      return NextResponse.json({ error: 'Missing required fields (userId or fcmToken)' }, { status: 400 });
    }

    // Update user fcmToken
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { fcmToken: fcmToken },
      { new: true }
    );

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Also try to update donor profile if exists
    try {
      await Donor.findOneAndUpdate({ user_id: userId }, { fcmToken }, { new: true });
    } catch (donorErr) {
      // Non-fatal if donor profile update fails
      console.warn('Warning: failed to update donor profile with fcmToken', donorErr.message);
    }

    console.log(`✅ FCM Token saved successfully for User ID: ${userId}`);
    return NextResponse.json({ success: true, user: updatedUser });

  } catch (error) {
    console.error('❌ Error saving FCM token:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
