import { NextResponse } from 'next/server';
import connectDB from '@/db/connectDB.mjs';
import Doner from '@/models/Doner.js';

export async function GET(req) {
  try {
    await connectDB();

    // Only return non-sensitive fields for public consumption
    const donors = await Doner.find({
      is_critical_ready: true,
      current_location: { $exists: true, $ne: null }
    }).select('current_location blood_type').limit(500);

    const sanitized = donors.map(d => ({
      _id: d._id,
      blood_type: d.blood_type,
      coordinates: d.current_location?.coordinates || null
    }));

    return NextResponse.json({ success: true, donors: sanitized, total: sanitized.length }, { status: 200 });
  } catch (error) {
    console.error('Error in public donors API:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch public donors' }, { status: 500 });
  }
}
