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
    const { action, currentStep, nextStep, subBatchVal, loyangCount, goodPcs, goodPacks, packSize, scrapPcs, durationMinutes, notes } = body as {
      action: "START" | "SUB_BATCH" | "STEP_TRANSITION" | "SCRAP" | "PAUSE";
      currentStep: string;
      nextStep?: string;
      subBatchVal?: number;
      loyangCount?: number;
      goodPcs?: number;
      goodPacks?: number;
      packSize?: number;
      scrapPcs?: number;
      durationMinutes?: number;
      notes?: string;
    };

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
      totalGoodPcs: 0,
      totalDefectPacks: 0,
      totalDefectPcs: 0,
    };

    const nextSummary = { ...currentSummary };
    const stepDurations = woData.stepDurationsMinutes || {};
    let nextStatus = woData.status || "IN_PROGRESS";
    let startedAt = woData.startedAt || FieldValue.serverTimestamp();
    let completedAt = woData.completedAt;
    let targetStage = nextStep || woData.currentStage || "DOUGH_COOKING";

    // Update Step Durations Accumulator
    if (durationMinutes && durationMinutes > 0) {
      stepDurations[currentStep] = (stepDurations[currentStep] || 0) + Number(durationMinutes);
    }

    // Sub-Batch Iterations (e.g. 1.5 + 1.5 adonan)
    if (action === "SUB_BATCH" && subBatchVal) {
      nextSummary.totalDoughBatchesDone = (nextSummary.totalDoughBatchesDone || 0) + Number(subBatchVal);
    }

    // Update Loyang count printed / stored in freezer
    if (loyangCount && loyangCount > 0) {
      nextSummary.totalTrayPrinted = Number(loyangCount);
      nextSummary.totalTrayInFreezer = Number(loyangCount);
    }

    // Good Output Pcs / Packs
    if (goodPacks && goodPacks > 0) {
      const pCount = Number(goodPacks);
      const size = Number(packSize) || 12;
      nextSummary.totalGoodPacks = pCount;
      nextSummary.totalGoodPcs = pCount * size;
    } else if (goodPcs && goodPcs > 0) {
      const pCount = Number(goodPcs);
      nextSummary.totalGoodPcs = (nextSummary.totalGoodPcs || 0) + pCount;
      nextSummary.totalGoodPacks = Math.floor(nextSummary.totalGoodPcs / 12);
    }

    // Scrap Output
    if (action === "SCRAP" || (scrapPcs && scrapPcs > 0)) {
      const sCount = Number(scrapPcs) || 1;
      nextSummary.totalDefectPcs += sCount;
      nextSummary.totalDefectPacks = Math.floor(nextSummary.totalDefectPcs / 12);
    }

    // Work Order Completion check
    if (targetStage === "DONE" || (nextSummary.totalGoodPacks > 0 && currentStep === "PRE_PACK")) {
      nextStatus = "COMPLETED";
      targetStage = "FINAL_PACK";
      completedAt = FieldValue.serverTimestamp();
    } else if (nextStatus === "PLANNED" || nextStatus === "RELEASED") {
      nextStatus = "IN_PROGRESS";
    }

    // Create Task Log Record
    const logRef = adminDb.collection("workOrderLogs").doc();
    const logData = {
      workOrderId,
      action: action || "STEP_TRANSITION",
      step: currentStep,
      valueAdded: subBatchVal || goodPcs || 0,
      defectCount: scrapPcs || 0,
      durationMinutes: durationMinutes || 0,
      loggedByCrewId: user.uid,
      loggedByCrewName: user.email || "Crew Dapur",
      timestamp: FieldValue.serverTimestamp(),
      notes: notes || "",
    };

    await Promise.all([
      logRef.set(logData),
      woRef.update({
        status: nextStatus,
        currentStage: targetStage,
        summaryState: nextSummary,
        stepDurationsMinutes: stepDurations,
        startedAt,
        completedAt: completedAt || null,
      }),
    ]);

    return NextResponse.json({
      success: true,
      logId: logRef.id,
      summaryState: nextSummary,
      currentStage: targetStage,
      status: nextStatus,
    });
  } catch (err) {
    console.error("POST /api/sfm/work-orders/[id]/step error:", err);
    return NextResponse.json({ error: "Gagal memproses transisi step task" }, { status: 500 });
  }
}
