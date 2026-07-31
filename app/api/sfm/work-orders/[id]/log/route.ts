import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  const { id: workOrderId } = await params;

  try {
    const body = await req.json();
    const { action, valueAdded, defectCount, defectReason, notes } = body as {
      action: "GOOD_OUTPUT" | "SCRAP";
      valueAdded: number;
      defectCount?: number;
      defectReason?: string;
      notes?: string;
    };

    const qty = Number(valueAdded) || 0;
    if (qty <= 0 && (!defectCount || defectCount <= 0)) {
      return NextResponse.json({ error: "Jumlah hasil produksi harus lebih dari 0" }, { status: 400 });
    }

    const woRef = adminDb.collection("workOrders").doc(workOrderId);
    const woSnap = await woRef.get();

    if (!woSnap.exists) {
      return NextResponse.json({ error: "Work Order tidak ditemukan" }, { status: 404 });
    }

    const woData = woSnap.data()!;
    const currentSummary = woData.summaryState || {
      totalDoughBatchesDone: 0,
      totalTrayPrinted: 0,
      totalTrayInFreezer: 0,
      totalGoodPacks: 0,
      totalDefectPacks: 0,
      totalDefectPcs: 0,
    };

    const nextSummary = { ...currentSummary };
    let nextStatus = woData.status || "IN_PROGRESS";
    let startedAt = woData.startedAt || FieldValue.serverTimestamp();
    let completedAt = woData.completedAt;
    let batchCode = woData.batchCode;
    let expiredDate = woData.expiredDate;

    if (action === "SCRAP" || (defectCount && defectCount > 0)) {
      const dCount = Number(defectCount) || qty;
      nextSummary.totalDefectPacks += dCount;
    } else {
      nextSummary.totalGoodPacks += qty;
    }

    // Auto-complete if total good output reaches target
    if (nextSummary.totalGoodPacks >= (woData.targetPacks || 50)) {
      nextStatus = "COMPLETED";
      completedAt = FieldValue.serverTimestamp();

      const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
      batchCode = batchCode || `CHR-${todayStr}-${workOrderId.slice(0, 4).toUpperCase()}`;

      const exp = new Date();
      exp.setMonth(exp.getMonth() + 6); // 6 months freezer shelf life
      expiredDate = expiredDate || exp.toISOString().split("T")[0];
    } else if (nextStatus === "PLANNED") {
      nextStatus = "IN_PROGRESS";
    }

    // Save Incremental Production Log
    const logRef = adminDb.collection("workOrderLogs").doc();
    const logData = {
      workOrderId,
      action: action || "GOOD_OUTPUT",
      valueAdded: qty,
      defectCount: defectCount || 0,
      defectReason: defectReason || "",
      loggedByCrewId: user.uid,
      loggedByCrewName: user.email || "Crew Dapur",
      timestamp: FieldValue.serverTimestamp(),
      notes: notes || "",
    };

    await Promise.all([
      logRef.set(logData),
      woRef.update({
        status: nextStatus,
        summaryState: nextSummary,
        startedAt,
        completedAt: completedAt || null,
        batchCode: batchCode || null,
        expiredDate: expiredDate || null,
      }),
    ]);

    return NextResponse.json({
      success: true,
      logId: logRef.id,
      summaryState: nextSummary,
      status: nextStatus,
    });
  } catch (err) {
    console.error("POST /api/sfm/work-orders/[id]/log error:", err);
    return NextResponse.json({ error: "Gagal menyimpan log hasil produksi" }, { status: 500 });
  }
}
