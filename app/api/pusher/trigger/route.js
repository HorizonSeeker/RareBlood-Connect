import Pusher from 'pusher';
import { NextResponse } from 'next/server';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  useTLS: true,
});

export async function POST(req) {
  try {
    const body = await req.json();
    const { message } = body;

    await pusher.trigger('blood-channel', 'new-alert', {
      message: message || 'Hello from Server!',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pusher trigger error', error);
    return NextResponse.json({ error: 'Lỗi gửi Pusher' }, { status: 500 });
  }
}
