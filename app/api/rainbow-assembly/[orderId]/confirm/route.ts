import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { orderId } = await params;

  try {
    const orderSnap = await adminDb.doc(`orders/${orderId}`).get();
    if (!orderSnap.exists) {
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
    }

    const itemsSnap = await adminDb
      .collection(`orders/${orderId}/items`)
      .where("assemblyStatus", "==", "pending_approval")
      .get();

    if (itemsSnap.empty) {
      return NextResponse.json({ error: "Tidak ada item Rainbow yang pending" }, { status: 400 });
    }

    await adminDb.runTransaction(async (tx) => {
      for (const itemDoc of itemsSnap.docs) {
        tx.update(itemDoc.ref, { assemblyStatus: "completed" });
      }
    });

    return NextResponse.json({
      success: true,
      itemsCompleted: itemsSnap.size,
    });
  } catch (err) {
    console.error("POST /api/rainbow-assembly/[orderId]/confirm error:", err);
    return NextResponse.json({ error: "Gagal konfirmasi assembly" }, { status: 500 });
  }
}
