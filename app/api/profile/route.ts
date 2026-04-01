import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const user = await User.findById(session.user.id).select("name email createdAt");
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ name: user.name, email: user.email, createdAt: user.createdAt });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action, currentPassword, newEmail, newPassword } = body;

  await connectDB();
  const user = await User.findById(session.user.id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Always verify current password first
  const passwordOk = await bcrypt.compare(currentPassword ?? "", user.passwordHash);
  if (!passwordOk) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  if (action === "change_email") {
    if (!newEmail || !newEmail.includes("@")) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    const existing = await User.findOne({ email: newEmail.toLowerCase().trim() });
    if (existing && existing._id.toString() !== session.user.id) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }
    user.email = newEmail.toLowerCase().trim();
    await user.save();
    return NextResponse.json({ success: true, message: "Email updated. Please sign in again." });
  }

  if (action === "change_password") {
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    return NextResponse.json({ success: true, message: "Password updated successfully." });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
