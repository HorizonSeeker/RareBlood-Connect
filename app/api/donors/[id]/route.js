import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB.mjs";
import Doner from "@/models/Doner.js"; 

// --- CHỨC NĂNG 3: UPDATE (Dùng _id) ---
export async function PUT(request, { params }) {
  try {
    const { id } = params; // Đây là _id 24 ký tự THẬT
    const body = await request.json(); 
    
    await connectDB();

    // Dùng findByIdAndUpdate vì 'id' bây giờ là '_id'
    const updatedDonor = await Doner.findByIdAndUpdate(id, body, {
      new: true, 
    });

    if (!updatedDonor) {
      return NextResponse.json({ error: "Donor not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Donor updated successfully", donor: updatedDonor },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating donor:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// --- CHỨC NĂNG 4: DELETE (Dùng _id) ---
export async function DELETE(request, { params }) {
  try {
    const { id } = params; // Đây là _id 24 ký tự THẬT

    await connectDB();

    // Dùng findByIdAndDelete
    const deletedDonor = await Doner.findByIdAndDelete(id);

    if (!deletedDonor) {
      return NextResponse.json({ error: "Donor not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Donor deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting donor:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}