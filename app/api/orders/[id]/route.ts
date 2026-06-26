import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const orderSnap = await adminDb.doc(`orders/${id}`).get();
    if (!orderSnap.exists) {
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
    }

    const d = orderSnap.data()!;
    const itemsSnap = await adminDb.collection(`orders/${id}/items`).get();
    const items = itemsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      id: orderSnap.id,
      orderNumber: d.orderNumber,
      source: d.source,
      customerId: d.customerId,
      customerName: d.customerName,
      customerPhone: d.customerPhone,
      channel: d.channel,
      status: d.status,
      paymentStatus: d.paymentStatus,
      paymentMethod: d.paymentMethod,
      needsProduction: d.needsProduction ?? false,
      shippingAddress: d.shippingAddress,
      requestedDeliveryDate: d.requestedDeliveryDate,
      orderNotes: d.orderNotes,
      proofOfTransferUrl: d.proofOfTransferUrl,
      shippingCost: d.shippingCost,
      shippingCostConfirmed: d.shippingCostConfirmed ?? false,
      invoiceNumber: d.invoiceNumber,
      invoiceUrl: d.invoiceUrl,
      createdBy: d.createdBy,
      createdAt: d.createdAt?.toDate?.().toISOString() ?? d.createdAt,
      completedAt: d.completedAt?.toDate?.().toISOString() ?? d.completedAt,
      items,
    });
  } catch (err) {
    console.error("GET /api/orders/[id] error:", err);
    return NextResponse.json({ error: "Gagal mengambil detail order" }, { status: 500 });
  }
}
