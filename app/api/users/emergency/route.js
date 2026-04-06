import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import BloodRequest from "@/models/BloodRequest.js";

export async function POST(req) {
  await connectDB();

  const auth = await authMiddleware(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Only "user" role allowed
  const roleError = roleCheck(auth.user, "user");
  if (roleError) {
    return NextResponse.json({ error: roleError.error }, { status: roleError.status });
  }

  try {
    const body = await req.json();
    const { bloodbank_id, blood_type, units_required } = body;

    if (!bloodbank_id || !blood_type || !units_required) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const newRequest = await BloodRequest.create({
      requested_by_user: auth.user.id,
      bloodbank_id,
      blood_type,
      units_required,
      request_type: "emergency"
    });

    // Try to send a real-time notification via Pusher (non-blocking)
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

        console.log("--> Sending emergency notification to Pusher...");
        await pusher.trigger('blood-channel', 'new-alert', {
          message: `🆘 EMERGENCY: Blood type ${newRequest.blood_type} (${newRequest.units_required} unit) urgently needed`,
          requestId: newRequest._id,
          bloodbankId: newRequest.bloodbank_id,
          isEmergency: true
        });
        console.log("--> Emergency notification sent!");
      } catch (err) {
        console.error('Pusher trigger error (non-blocking):', err);
      }
    })();

    return NextResponse.json({ message: "Emergency request created", request: newRequest }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
