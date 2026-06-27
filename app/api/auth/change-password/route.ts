import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-middleware";
import { adminAuth } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { password } = body;

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
    }

    await adminAuth.updateUser(user.uid, { password });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("POST /api/auth/change-password error:", err);
    return NextResponse.json({ error: err.message || "Gagal mengubah password" }, { status: 500 });
  }
}
