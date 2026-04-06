import { NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/authMiddleware';
import connectDB from '@/db/connectDB.mjs';
import User from '@/models/User.js';
import bcrypt from 'bcrypt';

export async function POST(req) {
  try {
    const token = await getAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - Please login or provide Bearer token' }, { status: 401 });
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(token.userId || token.sub);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);
    user.password = hashed;
    await user.save();

    return NextResponse.json({ message: 'Password changed successfully' }, { status: 200 });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Failed to change password', details: error.message }, { status: 500 });
  }
}
