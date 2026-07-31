import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  const { id: workOrderId } = await params;

  try {
    const body = await req.json();
    const { status, currentStage } = body as { status?: string; currentStage?: string };

    const woRef = adminDb.collection("workOrders").doc(workOrderId);
    const snap = await woRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Work Order tidak ditemukan" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (status) {
      updates.status = status;
      if (status === "IN_PROGRESS" && !snap.data()?.startedAt) {
        updates.startedAt = FieldValue.serverTimestamp();
      }
      if (status === "COMPLETED") {
        updates.completedAt = FieldValue.serverTimestamp();
        updates.currentStage = "DONE";
        
        const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
        if (!snap.data()?.batchCode) {
          updates.batchCode = `CHR-${todayStr}-${workOrderId.slice(0, 4).toUpperCase()}`;
        }
        if (!snap.data()?.expiredDate) {
          const exp = new Date();
          exp.setMonth(exp.getMonth() + 6);
          updates.expiredDate = exp.toISOString().split("T")[0];
        }
      }
    }
    if (currentStage) updates.currentStage = currentStage;

    await woRef.update(updates);

    return NextResponse.json({ success: true, ...updates });
  } catch (err) {
    console.error("PATCH /api/sfm/work-orders/[id]/status error:", err);
    return NextResponse.json({ error: "Gagal memperbarui status Work Order" }, { status: 500 });
  }
}
