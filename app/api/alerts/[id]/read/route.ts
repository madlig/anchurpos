import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import { FieldValue } from "firebase-admin/firestore";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    await adminDb.doc(`alerts/${id}`).update({
      isRead: true,
      readBy: auth.uid,
      readAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/alerts/[id]/read error:", err);
    return NextResponse.json({ error: "Gagal update alert" }, { status: 500 });
  }
}
