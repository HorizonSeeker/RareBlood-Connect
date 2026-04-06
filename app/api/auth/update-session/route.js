import { getServerSession } from "next-auth/next";
import { authOptions } from "../authOptions.js";
import connectDB from "@/db/connectDB.mjs";
import User from "@/models/User.js";

export async function POST(req) {
  try {
    console.log("🔄 Update session endpoint called");
    
    // Get current session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.log("❌ No session found");
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Connect to database
    await connectDB();
    
    // Fetch latest user data from database
    let user = await User.findOne({ email: session.user.email });
    // If Mongoose query is returned (has .lean), call it
    if (user && typeof user.lean === 'function') {
      user = await user.lean();
    }
    if (!user) {
      console.log("❌ User not found in database");
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    console.log(`✅ Updated session for user: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Registration Complete: ${user.isRegistrationComplete}`);

    // Return a success signal that the client should update the session
    return Response.json({
      success: true,
      needsUpdate: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        isRegistrationComplete: user.isRegistrationComplete
      }
    });

  } catch (error) {
    console.error("❌ Error updating session:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
