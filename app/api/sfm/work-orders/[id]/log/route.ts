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
    const { stage, valueAdded, unit, defectCount, defectReason, notes } = body as {
      stage: "DOUGH_MIXING" | "TRAY_PRINTING" | "FREEZER_CHECKPOINT" | "FINAL_PACKING";
      valueAdded: number;
      unit: "BATCH" | "LOYANG" | "PACK" | "PCS";
      defectCount?: number;
      defectReason?: string;
      notes?: string;
    };

    if (!stage || valueAdded === undefined || valueAdded < 0) {
      return NextResponse.json({ error: "Data log incremental tidak valid" }, { status: 400 });
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
    let nextStage = woData.currentStage || "DOUGH";
    let nextStatus = woData.status || "PLANNED";
    let freezerInAt = woData.freezerInAt;
    let startedAt = woData.startedAt;
    let completedAt = woData.completedAt;
    let batchCode = woData.batchCode;
    let expiredDate = woData.expiredDate;

    if (nextStatus === "PLANNED") {
      nextStatus = "IN_PROGRESS";
      startedAt = startedAt || FieldValue.serverTimestamp();
    }

    if (stage === "DOUGH_MIXING") {
      nextSummary.totalDoughBatchesDone = Number((nextSummary.totalDoughBatchesDone + valueAdded).toFixed(2));
      nextStage = "TRAY_PRINT";
    } else if (stage === "TRAY_PRINTING") {
      nextSummary.totalTrayPrinted += valueAdded;
      nextStage = "FREEZING";
    } else if (stage === "FREEZER_CHECKPOINT") {
      nextSummary.totalTrayInFreezer += valueAdded;
      nextStage = "FREEZING";
      if (!freezerInAt) {
        freezerInAt = FieldValue.serverTimestamp();
      }
    } else if (stage === "FINAL_PACKING") {
      nextSummary.totalGoodPacks += valueAdded;
      if (defectCount && defectCount > 0) {
        nextSummary.totalDefectPacks += defectCount;
      }
      nextStage = "PACKING";

      // Auto-complete if reached target packs or manually completed
      if (nextSummary.totalGoodPacks >= woData.targetPacks) {
        nextStage = "DONE";
        nextStatus = "COMPLETED";
        completedAt = FieldValue.serverTimestamp();

        const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
        batchCode = batchCode || `CHR-${todayStr}-${workOrderId.slice(0, 4).toUpperCase()}`;

        const exp = new Date();
        exp.setMonth(exp.getMonth() + 6); // 6 Months freezer shelf life
        expiredDate = expiredDate || exp.toISOString().split("T")[0];
      }
    }

    // Save Incremental Log
    const logRef = adminDb.collection("workOrderLogs").doc();
    const logData = {
      workOrderId,
      stage,
      valueAdded,
      unit,
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
        currentStage: nextStage,
        summaryState: nextSummary,
        startedAt: startedAt || FieldValue.serverTimestamp(),
        freezerInAt: freezerInAt || null,
        completedAt: completedAt || null,
        batchCode: batchCode || null,
        expiredDate: expiredDate || null,
      }),
    ]);

    return NextResponse.json({
      success: true,
      logId: logRef.id,
      summaryState: nextSummary,
      currentStage: nextStage,
      status: nextStatus,
    });
  } catch (err) {
    console.error("POST /api/sfm/work-orders/[id]/log error:", err);
    return NextResponse.json({ error: "Gagal menyimpan log incremental WO" }, { status: 500 });
  }
}
