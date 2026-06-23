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
  const { shippingCost } = (await req.json()) as { shippingCost: number };

  if (shippingCost === undefined || shippingCost < 0) {
    return NextResponse.json({ error: "Ongkir tidak valid" }, { status: 400 });
  }

  try {
    await adminDb.doc(`orders/${id}`).update({
      shippingCost,
      shippingCostConfirmed: true,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/orders/[id]/shipping error:", err);
    return NextResponse.json({ error: "Gagal update ongkir" }, { status: 500 });
  }
}
