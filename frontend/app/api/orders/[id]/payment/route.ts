import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const { paymentStatus, paymentMethod } = (await req.json()) as {
    paymentStatus: string;
    paymentMethod?: string;
  };

  if (!["belum_bayar", "sudah_bayar"].includes(paymentStatus)) {
    return NextResponse.json({ error: "Status pembayaran tidak valid" }, { status: 400 });
  }

  try {
    const updates: Record<string, unknown> = { paymentStatus };
    if (paymentMethod) updates.paymentMethod = paymentMethod;

    await adminDb.doc(`orders/${id}`).update(updates);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/orders/[id]/payment error:", err);
    return NextResponse.json({ error: "Gagal update pembayaran" }, { status: 500 });
  }
}
