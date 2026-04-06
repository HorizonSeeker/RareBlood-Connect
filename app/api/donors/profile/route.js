import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/authMiddleware";
import connectDB from '@/db/connectDB.mjs';
import Donor from '@/models/Doner.js';
import User from '@/models/User.js';

// Get donor profile and allow donor to update own profile (token-scoped)
export async function GET(req) {
  try {
    const token = await getAuthToken(req);
    // Use token.userId as the canonical user identifier
    if (!token) {
      console.warn('Donor profile: unauthorized - missing token');
      return NextResponse.json({ error: 'Unauthorized - Please login or provide Bearer token' }, { status: 401 });
    }

    await connectDB();
    console.log('Donor profile: looking up donor for userId', token.userId || token.sub);
    const donor = await Donor.findOne({ user_id: token.userId || token.sub });

    if (!donor) {
      console.warn('Donor profile not found for userId', token.userId || token.sub);
      return NextResponse.json({ error: 'Donor profile not found' }, { status: 404 });
    }

    // Fetch user to get canonical name/email (stored in User model)
    const userDoc = await User.findById(token.userId || token.sub).catch(() => null);
    return NextResponse.json({
      name: userDoc?.name || donor.name || '',
      mobile_number: donor.mobile_number,
      email: userDoc?.email || donor.email || '',
      emergency_contact_mobile: donor.emergency_contact_mobile,
      blood_type: donor.blood_type || null
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching donor profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const token = await getAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - Please login or provide Bearer token' }, { status: 401 });
    }

    await connectDB();
    const body = await req.json();

    // Separate fields that belong to User vs Donor
    const userUpdates = {};
    const donorUpdates = {};
    if (typeof body.name === 'string') userUpdates.name = body.name;
    if (typeof body.email === 'string') userUpdates.email = body.email;
    if (typeof body.mobile_number === 'string') donorUpdates.mobile_number = body.mobile_number;
    if (typeof body.emergency_contact_mobile === 'string') donorUpdates.emergency_contact_mobile = body.emergency_contact_mobile;

    console.log('Donor profile update - userId:', token.userId, 'userUpdates:', userUpdates, 'donorUpdates:', donorUpdates);

    if (Object.keys(userUpdates).length === 0 && Object.keys(donorUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided to update' }, { status: 400 });
    }

    // If email change requested, ensure it's not already used by another user
    if (userUpdates.email) {
      const existingEmailUser = await User.findOne({ email: userUpdates.email });
      if (existingEmailUser && existingEmailUser._id.toString() !== token.userId) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
      }
    }

    let updatedUser = null;
    if (Object.keys(userUpdates).length > 0) {
      updatedUser = await User.findByIdAndUpdate(token.userId, { $set: userUpdates }, { new: true });
    }

    const updated = await Donor.findOneAndUpdate(
      { user_id: token.userId },
      { $set: donorUpdates },
      { new: true }
    );

    if (!updated) {
      console.warn('Donor profile update failed - profile not found for userId', token.userId);
      return NextResponse.json({ error: 'Donor profile not found' }, { status: 404 });
    }

    console.log('Donor profile updated for userId', token.userId, 'updated donor:', {
      mobile_number: updated.mobile_number,
      emergency_contact_mobile: updated.emergency_contact_mobile
    });

    return NextResponse.json({
      message: 'Profile updated',
      donor: {
        name: updated.name || (updatedUser && updatedUser.name) || '',
        mobile_number: updated.mobile_number,
        email: updated.email || (updatedUser && updatedUser.email) || '',
        emergency_contact_mobile: updated.emergency_contact_mobile
      },
      user: updatedUser ? { name: updatedUser.name, email: updatedUser.email } : null
    }, { status: 200 });
  } catch (error) {
    console.error('Error updating donor profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}