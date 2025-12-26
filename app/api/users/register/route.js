import { NextResponse } from "next/server";
import connectDB from "@/db/connectDB";
import User from "@/models/User.js";
import bcrypt from "bcrypt"; // <- THÊM DÒNG NÀY

export async function POST(req) {
  await connectDB();

  try {
    const body = await req.json();
    // LẤY THÊM 'password' TỪ BODY
    const { name, age, blood_type, mobile_number, email, role, password } = body;

    // Validate required fields
    // THÊM '!password' VÀO ĐIỀU KIỆN CHECK
    if (!name || !mobile_number || !email || !role || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate role is one of the allowed values
    const allowedRoles = ["user", "hospital", "bloodbank_admin"];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const existingUserByMobile = await User.findOne({ mobile_number });
    if (existingUserByMobile) {
      return NextResponse.json(
        { error: "Mobile number already registered" },
        { status: 409 }
      );
    }

    // --- BẮT ĐẦU PHẦN SỬA QUAN TRỌNG ---

    // 1. Mã hóa mật khẩu (Hash the password)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 2. Tạo user với mật khẩu đã mã hóa
    const newUser = await User.create({
      name,
      age,
      blood_type,
      mobile_number,
      email,
      role,
      password: hashedPassword, // <- LƯU MẬT KHẨU ĐÃ MÃ HÓA
    });
    
    // --- KẾT THÚC PHẦN SỬA ---

    return NextResponse.json(
      { message: "User registered successfully", user: newUser },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Failed to register user" },
      { status: 500 }
    );
  }
}