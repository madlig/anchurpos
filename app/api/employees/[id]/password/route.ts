import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

// PATCH /api/employees/[id]/password — ganti password karyawan
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { password } = body as { password: string };

  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
  }

  try {
    await adminAuth.updateUser(params.id, { password });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/employees/[id]/password error:", err);
    return NextResponse.json({ error: "Gagal mengubah password" }, { status: 500 });
  }
}
