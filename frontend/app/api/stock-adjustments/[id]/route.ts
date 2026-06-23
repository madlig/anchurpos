import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const docRef = adminDb.doc(`stockAdjustments/${id}`);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });
    }

    await docRef.delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/stock-adjustments/[id] error:", err);
    return NextResponse.json({ error: "Gagal menghapus data" }, { status: 500 });
  }
}
