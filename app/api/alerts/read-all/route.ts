import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import { FieldValue } from "firebase-admin/firestore";

export async function PATCH(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const snap = await adminDb
      .collection("alerts")
      .where("isRead", "==", false)
      .get();

    const batch = adminDb.batch();
    for (const doc of snap.docs) {
      batch.update(doc.ref, {
        isRead: true,
        readBy: auth.uid,
        readAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    return NextResponse.json({ success: true, marked: snap.size });
  } catch (err) {
    console.error("PATCH /api/alerts/read-all error:", err);
    return NextResponse.json({ error: "Gagal update alerts" }, { status: 500 });
  }
}
