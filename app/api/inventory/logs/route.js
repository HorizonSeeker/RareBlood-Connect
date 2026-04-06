import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Logs API is working" });
}

export async function POST() {
  return NextResponse.json({ message: "Logs Created" });
}