import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const ordersSnap = await adminDb
      .collection("orders")
      .where("status", "==", "pending")
      .orderBy("createdAt", "desc")
      .get();

    const pendingOrders: Record<string, unknown>[] = [];

    for (const orderDoc of ordersSnap.docs) {
      const itemsSnap = await orderDoc.ref
        .collection("items")
        .where("assemblyStatus", "==", "pending_approval")
        .get();

      if (!itemsSnap.empty) {
        const d = orderDoc.data();
        const rainbowItems = itemsSnap.docs.map((doc) => ({
          id: doc.id,
          qty: doc.data().qty,
          variantName: doc.data().variantName,
        }));

        pendingOrders.push({
          orderId: orderDoc.id,
          orderNumber: d.orderNumber,
          customerName: d.customerName,
          createdAt: d.createdAt?.toDate?.().toISOString() ?? d.createdAt,
          rainbowItems,
        });
      }
    }

    return NextResponse.json(pendingOrders);
  } catch (err) {
    console.error("GET /api/rainbow-assembly/pending error:", err);
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}
