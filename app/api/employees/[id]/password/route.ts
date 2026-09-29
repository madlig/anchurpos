import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

// PATCH /api/employees/[id]/password — ganti password karyawan
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json();
  const { password } = body as { password: string };

  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
  }

  try {
    const snap = await adminDb.collection("users").doc(id).get();
    if (!snap.exists) return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
    const targetUser = snap.data();

    // Proteksi: Manager tidak boleh mengubah password Owner
    if (targetUser?.role === "owner" && auth.role !== "owner") {
      return NextResponse.json({ error: "Akses ditolak. Hanya Owner yang dapat mengubah password akun Owner." }, { status: 403 });
    }

    // Proteksi: Manager tidak boleh mengubah password sesama Manager (kecuali akun sendiri)
    if (auth.role === "manager" && targetUser?.role === "manager" && auth.uid !== id) {
      return NextResponse.json({ error: "Hanya Owner yang dapat mengubah password sesama Manager." }, { status: 403 });
    }

    await adminAuth.updateUser(id, { password });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/employees/[id]/password error:", err);
    return NextResponse.json({ error: "Gagal mengubah password" }, { status: 500 });
  }
}
