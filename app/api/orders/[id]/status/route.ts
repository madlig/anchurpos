import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const { status } = (await req.json()) as { status: string };

  if (!["pending", "selesai"].includes(status)) {
    return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
  }

  try {
    const updates: Record<string, unknown> = { status };
    if (status === "selesai") updates.completedAt = FieldValue.serverTimestamp();

    await adminDb.doc(`orders/${id}`).update(updates);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/orders/[id]/status error:", err);
    return NextResponse.json({ error: "Gagal update status" }, { status: 500 });
  }
}
