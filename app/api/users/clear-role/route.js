import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/authMiddleware";
import connectDB from "@/db/connectDB";
import User from "@/models/User.js";

export async function POST(req) {
  await connectDB();

  try {
    // Get the JWT token from the request
    const token = await getAuthToken(req);
    
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Please login or provide Bearer token" },
        { status: 401 }
      );
    }

    console.log("Clearing role for user ID:", token.userId || token.sub);

    // Clear user role in database
    const updatedUser = await User.findByIdAndUpdate(
      token.userId || token.sub,
      { role: null },
      { new: true }
    );

    if (!updatedUser) {
      console.log("User not found with ID:", token.userId || token.sub);
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    console.log("Successfully cleared user role:", updatedUser);

    return NextResponse.json(
      { 
        message: "Role cleared successfully", 
        user: {
          id: updatedUser._id,
          email: updatedUser.email,
          role: updatedUser.role,
          name: updatedUser.name
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Role clear error:", error);
    return NextResponse.json(
      { error: "Failed to clear role" },
      { status: 500 }
    );
  }
}
