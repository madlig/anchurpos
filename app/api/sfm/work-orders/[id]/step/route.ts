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
    const { action, currentStep, nextStep, subBatchVal, loyangCount, goodPcs, goodPacks, packSize, scrapPcs, prepackOutputs, durationMinutes, notes } = body as {
      action: "START" | "SUB_BATCH" | "STEP_TRANSITION" | "SCRAP" | "PAUSE";
      currentStep: string;
      nextStep?: string;
      subBatchVal?: number;
      loyangCount?: number;
      goodPcs?: number;
      goodPacks?: number;
      packSize?: number;
      scrapPcs?: number;
      prepackOutputs?: Record<string, { regular: string, full: string }>;
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
    let freezerInAt = woData.freezerInAt;
    let targetStage = nextStep || woData.currentStage || "DOUGH_COOKING";

    // --- Server-authoritative per-step timing ---
    // Finalisasi durasi step yang baru saja selesai: hitung dari currentStepStartedAt (server time).
    // Lebih akurat & tahan refresh/close daripada hitungan dari client.
    const prevStepStartedAt = woData.currentStepStartedAt;
    const nowMs = Date.now();
    let resolvedDurationMin = 0;
    if (prevStepStartedAt?.toMillis) {
      const startedMs = prevStepStartedAt.toMillis();
      resolvedDurationMin = Math.max(0, Math.round((nowMs - startedMs) / 60000));
    } else if (durationMinutes && durationMinutes > 0) {
      // Fallback untuk WO lama yang belum punya currentStepStartedAt
      resolvedDurationMin = Number(durationMinutes);
    }
    if (resolvedDurationMin > 0) {
      stepDurations[currentStep] = (stepDurations[currentStep] || 0) + resolvedDurationMin;
    }
    // Step/sub-batch berikutnya dimulai sekarang (server time).
    let currentStepStartedAt = FieldValue.serverTimestamp();

    // --- Freezer entry timestamp ---
    // Saat stage masuk FREEZER_CHECKPOINT untuk pertama kali, catat kapan loyang masuk freezer
    // agar crew bisa melihat sudah berapa lama membeku (tahan refresh karena server-side).
    if (targetStage === "FREEZER_CHECKPOINT" && !freezerInAt) {
      freezerInAt = FieldValue.serverTimestamp();
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
      nextSummary.totalGoodPcs = Number(goodPcs) || (pCount * size);
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
      durationMinutes: resolvedDurationMin || 0,
      loggedByCrewId: user.uid,
      loggedByCrewName: user.email || "Crew Dapur",
      timestamp: FieldValue.serverTimestamp(),
      notes: notes || "",
    };

    // --- INVENTORY INTEGRATION LOGIC ---
    const batch = adminDb.batch();
    batch.set(logRef, logData);
    batch.update(woRef, {
      status: nextStatus,
      currentStage: targetStage,
      summaryState: nextSummary,
      stepDurationsMinutes: stepDurations,
      startedAt,
      freezerInAt: freezerInAt || null,
      currentStepStartedAt,
      completedAt: completedAt || null,
    });

    if (nextStatus === "COMPLETED" && woData.status !== "COMPLETED") {
      if (woData.woType === "PRODUKSI" && currentStep === "PRE_PACK") {
        // Handle PRODUKSI BOM Packaging deduction & Product Stock increment
        if (prepackOutputs && Object.keys(prepackOutputs).length > 0) {
          // Multi-variant processing
          for (const [variantId, outputs] of Object.entries(prepackOutputs)) {
            const regPacks = parseFloat(outputs.regular) || 0;
            const fullPacks = parseFloat(outputs.full) || 0;
            
            if (regPacks > 0) {
              const rRef = adminDb.collection("productStocks").doc(`${variantId}_12`);
              batch.set(rRef, { stock: FieldValue.increment(regPacks) }, { merge: true });
              const mRef = adminDb.collection("stockMovements").doc();
              batch.set(mRef, { itemId: `${variantId}_12`, type: "PRODUKSI_IN", qty: regPacks, refId: woData.woNumber, timestamp: FieldValue.serverTimestamp() });
            }
            if (fullPacks > 0) {
              const fRef = adminDb.collection("productStocks").doc(`${variantId}_16`);
              batch.set(fRef, { stock: FieldValue.increment(fullPacks) }, { merge: true });
              const mRef = adminDb.collection("stockMovements").doc();
              batch.set(mRef, { itemId: `${variantId}_16`, type: "PRODUKSI_IN", qty: fullPacks, refId: woData.woNumber, timestamp: FieldValue.serverTimestamp() });
            }
          }
        } else if (goodPacks && goodPacks > 0) {
          // Single variant fallback
          const targetItem = packSize === 16 ? `${woData.productId}_16` : `${woData.productId}_12`;
          const pRef = adminDb.collection("productStocks").doc(targetItem);
          batch.set(pRef, { stock: FieldValue.increment(goodPacks) }, { merge: true });
          const mRef = adminDb.collection("stockMovements").doc();
          batch.set(mRef, { itemId: targetItem, type: "PRODUKSI_IN", qty: goodPacks, refId: woData.woNumber, timestamp: FieldValue.serverTimestamp() });
        }
        
        // Deduct Kemasan BOM (Thinwall, Stiker) based on packagingRecipes (mocking the query logic here, assuming typical recipe structure)
        const packagingRecipesSnap = await adminDb.collection("packagingRecipes").where("productId", "==", woData.productId || "churros-frozen-food").get();
        if (!packagingRecipesSnap.empty) {
          const packData = packagingRecipesSnap.docs[0].data();
          const items = packData.items || [];
          for (const item of items) {
            const qtyNeeded = (item.amount || 1) * (goodPacks || 0);
            if (item.ingredientId && qtyNeeded > 0) {
              batch.update(adminDb.collection("ingredients").doc(item.ingredientId), { stock: FieldValue.increment(-qtyNeeded) });
            }
          }
        }

      } else if (woData.woType === "REPACK_SAOS" || woData.woType === "REPACK_GULA") {
        // Handle REPACK: Deduct bulk, Increment small packs (ingredients)
        const targetId = woData.repackIngredientId || woData.productId; // The result of the repack
        if (targetId && goodPcs && goodPcs > 0) {
          batch.set(adminDb.collection("ingredients").doc(targetId), { stock: FieldValue.increment(goodPcs) }, { merge: true });
          const mRef = adminDb.collection("stockMovements").doc();
          batch.set(mRef, { itemId: targetId, type: "REPACK_IN", qty: goodPcs, refId: woData.woNumber, timestamp: FieldValue.serverTimestamp() });
          
          // Deduct from Repack BOM
          const repackBomSnap = await adminDb.collection("recipes").where("category", "==", "prepack").where("productId", "==", targetId).get();
          if (!repackBomSnap.empty) {
            const recipeData = repackBomSnap.docs[0].data();
            for (const ing of recipeData.ingredients || []) {
              const qtyNeeded = (ing.amount || 1) * goodPcs;
              if (ing.ingredientId && qtyNeeded > 0) {
                batch.update(adminDb.collection("ingredients").doc(ing.ingredientId), { stock: FieldValue.increment(-qtyNeeded) });
              }
            }
          }
        }

      } else if (woData.woType === "PACKING_PESANAN" && woData.sourceOrderId) {
        // Handle PACKING: Complete Order and deduct Product Stocks
        const orderRef = adminDb.collection("orders").doc(woData.sourceOrderId);
        const orderSnap = await orderRef.get();
        if (orderSnap.exists) {
          batch.update(orderRef, { status: "completed", packedAt: FieldValue.serverTimestamp() });
          
          const orderData = orderSnap.data();
          for (const item of orderData?.items || []) {
            if (item.type === "product") {
              const stockId = item.productId === "churros-reguler" ? `${item.variantId}_12` : `${item.variantId}_16`;
              batch.set(adminDb.collection("productStocks").doc(stockId), { stock: FieldValue.increment(-item.qty) }, { merge: true });
              const mRef = adminDb.collection("stockMovements").doc();
              batch.set(mRef, { itemId: stockId, type: "ORDER_OUT", qty: item.qty, refId: orderRef.id, timestamp: FieldValue.serverTimestamp() });
            } else if (item.type === "addon") {
              batch.update(adminDb.collection("ingredients").doc(item.addonId), { stock: FieldValue.increment(-item.qty) });
            }
          }
        }
      }
    }

    await batch.commit();

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
