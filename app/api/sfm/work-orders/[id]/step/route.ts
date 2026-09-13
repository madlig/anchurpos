import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";
import { pushNotificationToRole, createSfmAlert } from "@/lib/sfm-notifications";

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
    const { action, currentStep, nextStep, subBatchVal, loyangCount, goodPcs, goodPacks, packSize, scrapPcs, prepackOutputs, durationMinutes, notes, pausedReason, variantId } = body as {
      action: "START" | "SUB_BATCH" | "STEP_TRANSITION" | "SCRAP" | "PAUSE" | "RESUME" | "MIXING_SUB_BATCH" | "TRAY_MOLDING" | "FINISH_MOLDING" | "PARTIAL_PREPACK" | "CUT_TRAY" | "CLOSE_WO";
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
      pausedReason?: string;
      variantId?: string;
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
    const nowMs = Date.now();

    // --- PAUSE & RESUME Logic ---
    if (action === "PAUSE") {
      if (!pausedReason) return NextResponse.json({ error: "Alasan jeda wajib diisi" }, { status: 400 });
      const logRef = adminDb.collection("workOrderLogs").doc();
      const batch = adminDb.batch();
      batch.update(woRef, { pausedAt: FieldValue.serverTimestamp(), pausedReason });
      batch.set(logRef, {
        workOrderId, action: "PAUSE", step: currentStep, valueAdded: 0, unit: "BATCH",
        loggedByCrewId: user.uid, loggedByCrewName: user.email || "Crew Dapur",
        timestamp: FieldValue.serverTimestamp(), notes: pausedReason
      });
      await batch.commit();
      return NextResponse.json({ message: "Work Order dijeda" });
    }

    let nextTotalPauseMs = woData.totalPauseMs || 0;
    let nextPauseCount = woData.pauseCount || 0;
    let variantState = woData.variantState || {};

    if (action === "RESUME") {
      if (woData.pausedAt) {
        const pauseStartMs = woData.pausedAt.toDate().getTime();
        const pauseDurationMs = nowMs - pauseStartMs;
        nextTotalPauseMs += pauseDurationMs;
        nextPauseCount += 1;
        
        // Geser timestamp stasiun agar waktu jeda tidak dihitung sebagai durasi kerja
        if (variantState) {
          for (const vid in variantState) {
            if (variantState[vid].doughStationStartedAt) {
              const dTime = variantState[vid].doughStationStartedAt.toDate().getTime();
              variantState[vid].doughStationStartedAt = new Date(dTime + pauseDurationMs);
            }
            if (variantState[vid].mixingStationStartedAt) {
              const mTime = variantState[vid].mixingStationStartedAt.toDate().getTime();
              variantState[vid].mixingStationStartedAt = new Date(mTime + pauseDurationMs);
            }
          }
        }
        if (woData.currentStepStartedAt) {
          const cTime = woData.currentStepStartedAt.toDate().getTime();
          woData.currentStepStartedAt = new Date(cTime + pauseDurationMs) as any;
        }
      }
    }

    const effectiveVariantId = variantId || (woData.productionTargets?.[0]?.variantId) || woData.productId || "churros-frozen-food";
    let vs = variantState[effectiveVariantId];
    if (!vs) {
      vs = { doughBatchesDone: 0, mixingBatchesDone: 0, loyangPrinted: 0, loyangCut: 0, frozenTrays: 0, goodPacks: 0, goodPcs: 0, defectPcs: 0 };
      variantState[effectiveVariantId] = vs;
    }

    const prevStepStartedAt = woData.currentStepStartedAt;
    let resolvedDurationMin = 0;
    if (woData.pausedAt) {
      resolvedDurationMin = 0;
    } else {
      let startedMs = prevStepStartedAt?.toMillis ? prevStepStartedAt.toMillis() : Date.now();
      
      if (action === "SUB_BATCH" && vs.doughStationStartedAt?.toMillis) {
        startedMs = vs.doughStationStartedAt.toMillis();
      } else if (action === "MIXING_SUB_BATCH" && vs.mixingStationStartedAt?.toMillis) {
        startedMs = vs.mixingStationStartedAt.toMillis();
      } else if (durationMinutes && durationMinutes > 0 && !prevStepStartedAt) {
        startedMs = Date.now() - (durationMinutes * 60000);
      }
      
      resolvedDurationMin = Math.max(0, Math.round((nowMs - startedMs) / 60000));
    }
    
    if (resolvedDurationMin > 0) {
      const stationKey = action === "SUB_BATCH" ? "DOUGH_COOKING"
        : action === "MIXING_SUB_BATCH" ? "MIXING_EGG"
        : action === "TRAY_MOLDING" ? "TRAY_MOLDING"
        : action === "CUT_TRAY" ? "CUT_CHURROS"
        : action === "PARTIAL_PREPACK" ? "PRE_PACK"
        : action === "CLOSE_WO" ? "PRE_PACK"
        : currentStep;
      stepDurations[stationKey] = (stepDurations[stationKey] || 0) + resolvedDurationMin;
    }
    // Step/sub-batch berikutnya dimulai sekarang (server time), kecuali jika resume
    let currentStepStartedAt: any = FieldValue.serverTimestamp();
    if (action === "RESUME" && woData.currentStepStartedAt) {
      currentStepStartedAt = woData.currentStepStartedAt;
    }

    // --- Freezer entry timestamp ---
    // Saat stage masuk FREEZER_CHECKPOINT untuk pertama kali, catat kapan loyang masuk freezer
    // agar crew bisa melihat sudah berapa lama membeku (tahan refresh karena server-side).
    if (targetStage === "FREEZER_CHECKPOINT" && !freezerInAt) {
      freezerInAt = FieldValue.serverTimestamp();
    }

    // Phase 3: Per-Variant tracking & TRAY_MOLDING bug fix
    if (action === "SUB_BATCH" && subBatchVal) {
      vs.doughBatchesDone = (vs.doughBatchesDone || 0) + Number(subBatchVal);
      vs.doughStationStartedAt = FieldValue.serverTimestamp() as any;
      nextSummary.totalDoughBatchesDone = (nextSummary.totalDoughBatchesDone || 0) + Number(subBatchVal);
    } else if (action === "MIXING_SUB_BATCH" && subBatchVal) {
      vs.mixingBatchesDone = (vs.mixingBatchesDone || 0) + Number(subBatchVal);
      vs.mixingStationStartedAt = FieldValue.serverTimestamp() as any;
    } else if (action === "FINISH_MOLDING") {
      vs.moldingDone = true;
    } else if (action === "CUT_TRAY") {
      const lc = Number(loyangCount) || 0;
      const gp = Number(goodPcs) || 0;
      if (lc > 0) {
        vs.loyangCut = (vs.loyangCut || 0) + lc;
        vs.frozenTrays = (vs.frozenTrays || 0) + lc;
      }
      if (gp > 0) {
        vs.goodPcs = (vs.goodPcs || 0) + gp;
        nextSummary.totalGoodPcs = (nextSummary.totalGoodPcs || 0) + gp;
        nextSummary.totalGoodPacks = Math.floor(nextSummary.totalGoodPcs / 12);
      }
    }

    // Update Loyang count printed
    if (loyangCount && loyangCount > 0 && action === "TRAY_MOLDING") {
      const lc = Number(loyangCount);
      nextSummary.totalTrayPrinted = (nextSummary.totalTrayPrinted || 0) + lc;
      vs.loyangPrinted = (vs.loyangPrinted || 0) + lc;
      // TRAY_MOLDING TIDAK menambah frozenTrays, baru di CUT_TRAY
    }
    
    // Partial Prepack (Cicilan Pack) & Good Packs logic
    if (action === "PARTIAL_PREPACK" && goodPacks && goodPacks > 0) {
      const pCount = Number(goodPacks);
      const size = Number(packSize) || 12;
      const lUsed = Number(loyangCount) || 0;
      
      nextSummary.totalGoodPacks = (nextSummary.totalGoodPacks || 0) + pCount;
      nextSummary.totalGoodPcs = (nextSummary.totalGoodPcs || 0) + (pCount * size);
      
      vs.goodPacks = (vs.goodPacks || 0) + pCount;
      vs.frozenTrays = Math.max(0, (vs.frozenTrays || 0) - lUsed);
    } else if (goodPacks && goodPacks > 0 && action !== "PARTIAL_PREPACK") {
      const pCount = Number(goodPacks);
      const size = Number(packSize) || 12;
      nextSummary.totalGoodPacks = pCount;
      nextSummary.totalGoodPcs = Number(goodPcs) || (pCount * size);
    } else if (goodPcs && goodPcs > 0 && action !== "CUT_TRAY") {
      const pCount = Number(goodPcs);
      nextSummary.totalGoodPcs = (nextSummary.totalGoodPcs || 0) + pCount;
      nextSummary.totalGoodPacks = Math.floor(nextSummary.totalGoodPcs / 12);
    }
    
    // Auto-fill output for PACKING_PESANAN on completion if not provided
    if (action === "CLOSE_WO" && woData.woType === "PACKING_PESANAN") {
      if (!goodPacks && !goodPcs) {
        const targetPacks = woData.targetPacks || 0;
        const targetQty = woData.targetQty || 0;
        if (targetPacks > 0) {
          nextSummary.totalGoodPacks = targetPacks;
          nextSummary.totalGoodPcs = targetPacks * 12;
        } else if (targetQty > 0) {
          nextSummary.totalGoodPcs = targetQty;
          nextSummary.totalGoodPacks = Math.floor(targetQty / 12);
        }
      }
    }

    // Scrap Output
    if (action === "SCRAP" || (scrapPcs && scrapPcs > 0)) {
      const sCount = Number(scrapPcs) || 1;
      nextSummary.totalDefectPcs = (nextSummary.totalDefectPcs || 0) + sCount;
      nextSummary.totalDefectPacks = Math.floor(nextSummary.totalDefectPcs / 12);
      vs.defectPcs = (vs.defectPcs || 0) + sCount;
    }

    // Work Order Completion check
    if (action === "CLOSE_WO" || targetStage === "DONE") {
      if (woData.woType === "PRODUKSI" && variantState && Object.keys(variantState).length > 0) {
        let remainingTrays = 0;
        for (const vid in variantState) {
          remainingTrays += (variantState[vid].frozenTrays || 0);
        }
        if (remainingTrays > 0) {
          return NextResponse.json({ error: `Masih ada ${remainingTrays} loyang di freezer, tidak bisa tutup WO` }, { status: 400 });
        }
      }
      
      nextStatus = "COMPLETED";
      if (woData.woType === "PRODUKSI" || !woData.woType) targetStage = "FINAL_PACK";
      else if (woData.woType === "PACKING_PESANAN") targetStage = "PACKING";
      else if (woData.woType === "REPACK_SAOS" || woData.woType === "REPACK_GULA") targetStage = "REPACKING";
      else if (woData.woType === "STOCK_OPNAME") targetStage = "COUNTING";
      else targetStage = "IN_PROGRESS";
      
      completedAt = FieldValue.serverTimestamp();
    } else {
      if (nextStatus === "PLANNED" || nextStatus === "RELEASED") {
        nextStatus = "IN_PROGRESS";
      }
      
      const totalFrozen: number = Object.values(variantState).reduce((s: number, v: any) => s + (v.frozenTrays || 0), 0);
      const totalGood: number = Object.values(variantState).reduce((s: number, v: any) => s + (v.goodPacks || 0), 0);
      const totalCut: number = Object.values(variantState).reduce((s: number, v: any) => s + (v.loyangCut || 0), 0);
      const totalPrinted: number = Object.values(variantState).reduce((s: number, v: any) => s + (v.loyangPrinted || 0), 0);

      let computedStage = "DOUGH_COOKING";
      if (woData.woType === "PRODUKSI" || !woData.woType) {
        if (totalGood > 0) computedStage = "FINAL_PACK";
        else if (totalFrozen > 0 || totalCut > 0) computedStage = "FREEZER_CHECKPOINT";
        else if (totalPrinted > 0) computedStage = "TRAY_MOLDING";
        else computedStage = "DOUGH_COOKING";
      } else {
        if (woData.woType === "PACKING_PESANAN") computedStage = "PACKING";
        else if (woData.woType === "REPACK_SAOS" || woData.woType === "REPACK_GULA") computedStage = "REPACKING";
        else if (woData.woType === "STOCK_OPNAME") computedStage = "COUNTING";
        else computedStage = "IN_PROGRESS";
      }
      
      targetStage = computedStage;
    }

    // Create Task Log Record
    const logRef = adminDb.collection("workOrderLogs").doc();
    const logData: any = {
      workOrderId: workOrderId,
      stage: targetStage,
      step: targetStage,
      action: action || "STEP_TRANSITION",
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
    
    const updatePayload: any = {
      status: nextStatus,
      currentStage: targetStage,
      summaryState: nextSummary,
      stepDurationsMinutes: stepDurations,
      startedAt,
      freezerInAt: freezerInAt || null,
      currentStepStartedAt,
      completedAt: completedAt || null,
      totalPauseMs: nextTotalPauseMs,
      pauseCount: nextPauseCount,
      variantState: variantState
    };

    if (action === "RESUME") {
      updatePayload.pausedAt = FieldValue.delete();
      updatePayload.pausedReason = FieldValue.delete();
    }
    
    batch.update(woRef, updatePayload);

    // Phase 3 & 4: Inventory Integration per action
    if (action === "PARTIAL_PREPACK" && prepackOutputs && Object.keys(prepackOutputs).length > 0) {
      let totalRegPacksAll = 0;
      let totalFullPacksAll = 0;

      for (const [vId, outputs] of Object.entries(prepackOutputs)) {
        const regPacks = parseFloat(outputs.regular) || 0;
        const fullPacks = parseFloat(outputs.full) || 0;

        if (regPacks > 0) {
          totalRegPacksAll += regPacks;
          const regStockId = `churros-frozen-regular_${vId}`;
          const rRef = adminDb.collection("productStocks").doc(regStockId);
          batch.set(
            rRef,
            {
              productId: "churros-frozen-regular",
              variantId: vId,
              currentStock: FieldValue.increment(regPacks),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          batch.set(adminDb.collection("stockMovements").doc(), {
            ingredientId: `product:${regStockId}`,
            changeAmount: regPacks,
            sourceType: "production",
            sourceId: woRef.id,
            note: `Hasil pre-pack regular WO #${woData.woNumber}`,
            createdBy: user.uid,
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        if (fullPacks > 0) {
          totalFullPacksAll += fullPacks;
          const fullStockId = `churros-frozen-full_${vId}`;
          const fRef = adminDb.collection("productStocks").doc(fullStockId);
          batch.set(
            fRef,
            {
              productId: "churros-frozen-full",
              variantId: vId,
              currentStock: FieldValue.increment(fullPacks),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          batch.set(adminDb.collection("stockMovements").doc(), {
            ingredientId: `product:${fullStockId}`,
            changeAmount: fullPacks,
            sourceType: "production",
            sourceId: woRef.id,
            note: `Hasil pre-pack full WO #${woData.woNumber}`,
            createdBy: user.uid,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      }

      // Deduct packaging materials from packagingRecipes
      if (totalRegPacksAll > 0) {
        const regPkgSnap = await adminDb
          .collection("packagingRecipes")
          .where("productId", "==", "churros-frozen-regular")
          .get();
        for (const doc of regPkgSnap.docs) {
          const packData = doc.data();
          const qtyNeeded = (Number(packData.qtyPerPack) || 1) * totalRegPacksAll;
          if (packData.ingredientId && qtyNeeded > 0) {
            batch.update(adminDb.collection("ingredients").doc(packData.ingredientId), {
              currentStock: FieldValue.increment(-qtyNeeded),
            });
            batch.set(adminDb.collection("stockMovements").doc(), {
              ingredientId: packData.ingredientId,
              changeAmount: -qtyNeeded,
              sourceType: "production_packaging",
              sourceId: woRef.id,
              note: `Kemasan regular WO #${woData.woNumber}`,
              createdBy: user.uid,
              createdAt: FieldValue.serverTimestamp(),
            });
          }
        }
      }

      if (totalFullPacksAll > 0) {
        const fullPkgSnap = await adminDb
          .collection("packagingRecipes")
          .where("productId", "==", "churros-frozen-full")
          .get();
        for (const doc of fullPkgSnap.docs) {
          const packData = doc.data();
          const qtyNeeded = (Number(packData.qtyPerPack) || 1) * totalFullPacksAll;
          if (packData.ingredientId && qtyNeeded > 0) {
            batch.update(adminDb.collection("ingredients").doc(packData.ingredientId), {
              currentStock: FieldValue.increment(-qtyNeeded),
            });
            batch.set(adminDb.collection("stockMovements").doc(), {
              ingredientId: packData.ingredientId,
              changeAmount: -qtyNeeded,
              sourceType: "production_packaging",
              sourceId: woRef.id,
              note: `Kemasan full WO #${woData.woNumber}`,
              createdBy: user.uid,
              createdAt: FieldValue.serverTimestamp(),
            });
          }
        }
      }
    }

    if (nextStatus === "COMPLETED" && woData.status !== "COMPLETED") {
      if (woData.woType === "REPACK_SAOS" || woData.woType === "REPACK_GULA") {
        // Handle REPACK: Deduct bulk, Increment small packs (ingredients)
        const targetId = woData.repackIngredientId || woData.productId;
        if (targetId && goodPcs && goodPcs > 0) {
          batch.set(
            adminDb.collection("ingredients").doc(targetId),
            {
              currentStock: FieldValue.increment(goodPcs),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          batch.set(adminDb.collection("stockMovements").doc(), {
            ingredientId: targetId,
            changeAmount: goodPcs,
            sourceType: "repack",
            sourceId: woRef.id,
            note: `Hasil repack WO #${woData.woNumber}`,
            createdBy: user.uid,
            createdAt: FieldValue.serverTimestamp(),
          });

          // Deduct from prepackRecipes
          const repackBomSnap = await adminDb
            .collection("prepackRecipes")
            .where("targetItemId", "==", targetId)
            .get();
          for (const doc of repackBomSnap.docs) {
            const recipeData = doc.data();
            const yieldRatio = Number(recipeData.outputYieldQty) > 0 ? Number(recipeData.outputYieldQty) : 1;
            const qtyNeeded = ((Number(recipeData.qtyPerPack) || 1) / yieldRatio) * goodPcs;
            if (recipeData.ingredientId && qtyNeeded > 0) {
              batch.update(adminDb.collection("ingredients").doc(recipeData.ingredientId), {
                currentStock: FieldValue.increment(-qtyNeeded),
              });
              batch.set(adminDb.collection("stockMovements").doc(), {
                ingredientId: recipeData.ingredientId,
                changeAmount: -qtyNeeded,
                sourceType: "repack",
                sourceId: woRef.id,
                note: `Bahan curah repack WO #${woData.woNumber}`,
                createdBy: user.uid,
                createdAt: FieldValue.serverTimestamp(),
              });
            }
          }
        }
      } else if (woData.woType === "PACKING_PESANAN" && woData.sourceOrderId) {
        // Handle PACKING: Complete Order packing status (stok produk sudah dipotong saat order dibuat)
        const orderRef = adminDb.collection("orders").doc(woData.sourceOrderId);
        const orderSnap = await orderRef.get();
        if (orderSnap.exists) {
          batch.update(orderRef, { packedAt: FieldValue.serverTimestamp() });
        }
      }
    }

    await batch.commit();

    // --- PHASE 3: Trigger Notifications ---
    if (action === "STEP_TRANSITION" && nextStatus !== "COMPLETED") {
      await pushNotificationToRole({
        role: "manager",
        title: "Update Work Order",
        body: `WO ${woData.woNumber} - Step ${currentStep} selesai`,
        data: { type: "sfm_wo_step", workOrderId: woRef.id },
      });
    } else if (nextStatus === "COMPLETED") {
      const title = "Work Order Selesai";
      const body = `Produksi ${woData.productName || "Produk"} selesai (WO ${woData.woNumber})`;
      
      await createSfmAlert({
        type: "sfm_wo_completed",
        severity: "success",
        title,
        message: body,
        sourceId: woRef.id,
      });

      await pushNotificationToRole({
        role: "manager",
        title,
        body,
        data: { type: "sfm_wo_completed", workOrderId: woRef.id },
      });

      await pushNotificationToRole({
        role: "owner",
        title,
        body,
        data: { type: "sfm_wo_completed", workOrderId: woRef.id },
      });
    }

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
