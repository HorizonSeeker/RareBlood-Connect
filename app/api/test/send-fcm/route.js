import { NextResponse } from 'next/server';
import admin from '@/config/firebase.mjs';

// Simple protected endpoint to test server-side FCM sends.
// POST body: { tokens: string[], notification: { title, body }, data?: {} }
// Protect by header: x-fcm-test-secret must match process.env.FCM_TEST_SECRET

export async function POST(req) {
  try {
    const secretHeader = req.headers.get('x-fcm-test-secret');
    if (!process.env.FCM_TEST_SECRET || secretHeader !== process.env.FCM_TEST_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tokens, notification, data } = body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ error: 'No tokens provided' }, { status: 400 });
    }

    // Remove duplicate tokens (same device registered more than once)
    const uniqueTokens = Array.from(new Set(tokens));
    if (uniqueTokens.length !== tokens.length) {
      console.log(`🔁 Removed ${tokens.length - uniqueTokens.length} duplicate token(s) before test send`);
    }

    // Build message payload
    const message = {
      notification: notification || { title: 'Test FCM', body: 'This is a test message' },
      data: data || {},
      tokens: uniqueTokens
    };

    if (!admin || typeof admin.messaging !== 'function') {
      // If admin not initialized, respond with noop info
      console.warn('Firebase admin not initialized; send will be noop');
      return NextResponse.json({ success: false, reason: 'Firebase admin not initialized' });
    }

    const response = await admin.messaging().sendMulticast(message);
    return NextResponse.json({ success: true, result: response });
  } catch (err) {
    console.error('Error in test send-fcm:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import connectDB from '@/db/connectDB.mjs';
import admin from '@/config/firebase.mjs';

export async function POST(req) {
  try {
    await connectDB();
    const { tokens, title, body, data } = await req.json();

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ error: 'tokens (array) required in body' }, { status: 400 });
    }

    const uniqueTokens = Array.from(new Set(tokens));
    if (uniqueTokens.length !== tokens.length) {
      console.log(`🔁 Removed ${tokens.length - uniqueTokens.length} duplicate token(s) before test send`);
    }

    const message = {
      notification: { title: title || 'Test Notification', body: body || 'This is a test' },
      data: data || {},
      tokens: uniqueTokens
    };

    if (!admin || typeof admin.messaging !== 'function') {
      console.warn('Firebase admin not initialized - skipping actual send');
      return NextResponse.json({ message: 'Firebase admin not initialized - mock send', tokensSent: 0 });
    }

    const response = await admin.messaging().sendMulticast(message);
    return NextResponse.json({ success: true, result: response }, { status: 200 });
  } catch (error) {
    console.error('Test FCM send error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
