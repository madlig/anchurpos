import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import { FieldValue } from "firebase-admin/firestore";
import { shiftReportSchema } from "@/lib/validations";
import { createSfmAlert } from "@/lib/sfm-notifications";

// Standard Cycle Times in minutes
const STD_COOKING_MIN_PER_BATCH = 45;
const STD_PREPACK_MIN_PER_PACK = 1.5;
const STD_SAUCE_MIN_PER_CUP = 0.6; // 30 min for 50 cups
const STD_SUGAR_MIN_PER_PACK = 0.5; // 25 min for 50 packs
const STD_ORDER_PACKING_MIN_PER_PKG = 3.0;

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload JSON tidak valid" }, { status: 400 });
  }

  const parseResult = shiftReportSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Data laporan shift tidak valid", details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const data = parseResult.data;
  const now = new Date();
  const dateStr = data.date || now.toISOString().split("T")[0];
  const dateCompact = dateStr.replace(/-/g, "");

  try {
    // Generate Report Number: SR-YYYYMMDD-XXXX
    const reportRef = adminDb.collection("shiftReports").doc();
    const reportNumber = `SR-${dateCompact}-${reportRef.id.slice(0, 4).toUpperCase()}`;

    // --- 1. Compute Durations & Speed Score ---
    let stdTotalMinutes = 0;
    let actualReportedMinutes = 0;

    const cooking = data.activities.cookingAndMolding;
    let totalBatchesCooked = 0;
    let totalPcsCooked = 0;
    let totalLoyangCooked = 0;

    if (cooking && cooking.targets && cooking.targets.length > 0) {
      cooking.targets.forEach((t) => {
        totalBatchesCooked += t.batches || 0;
        totalPcsCooked += t.pcs || 0;
        totalLoyangCooked += t.loyang || 0;
      });
      stdTotalMinutes += totalBatchesCooked * STD_COOKING_MIN_PER_BATCH;
      const netCooking = Math.max(0, (cooking.durationMinutes || 0) - (cooking.pauseMinutes || 0));
      actualReportedMinutes += netCooking;
    }

    const prepack = data.activities.thinwallPrepack;
    let totalThinwallPacks = 0;
    if (prepack && prepack.items && prepack.items.length > 0) {
      prepack.items.forEach((p) => {
        totalThinwallPacks += (p.regularPacks || 0) + (p.fullPacks || 0);
      });
      stdTotalMinutes += totalThinwallPacks * STD_PREPACK_MIN_PER_PACK;
      actualReportedMinutes += prepack.durationMinutes || 0;
    }

    const sauce = data.activities.sauceRepack;
    let totalSauceCups = 0;
    if (sauce && sauce.items && sauce.items.length > 0) {
      sauce.items.forEach((s) => {
        totalSauceCups += s.outputPcs || 0;
      });
      stdTotalMinutes += totalSauceCups * STD_SAUCE_MIN_PER_CUP;
      actualReportedMinutes += sauce.durationMinutes || 0;
    }

    const sugar = data.activities.sugarRepack;
    let totalSugarPacks = 0;
    if (sugar && sugar.items && sugar.items.length > 0) {
      sugar.items.forEach((sg) => {
        totalSugarPacks += sg.outputPacks || 0;
      });
      stdTotalMinutes += totalSugarPacks * STD_SUGAR_MIN_PER_PACK;
      actualReportedMinutes += sugar.durationMinutes || 0;
    }

    const orderPacking = data.activities.orderPacking;
    if (orderPacking && orderPacking.totalPackagesPacked > 0) {
      stdTotalMinutes += orderPacking.totalPackagesPacked * STD_ORDER_PACKING_MIN_PER_PKG;
      actualReportedMinutes += orderPacking.durationMinutes || 0;
    }

    const deepCleaning = data.activities.deepCleaningAndExtra;
    if (deepCleaning && deepCleaning.isDeepCleaning) {
      stdTotalMinutes += deepCleaning.durationMinutes || 60;
      actualReportedMinutes += deepCleaning.durationMinutes || 60;
    }

    let speedScore = 100;
    if (actualReportedMinutes > 0 && stdTotalMinutes > 0) {
      speedScore = Math.min(130, Math.max(50, Math.round((stdTotalMinutes / actualReportedMinutes) * 100)));
    }

    // --- 2. Check Overtime Eligibility ---
    // Rule: standard 2 batches per person per shift. If > standard or extra deep cleaning -> overtime!
    const crewCount = data.crewIds.length || 1;
    const maxStandardBatches = crewCount * 2;
    let isEligible = false;
    let overtimeReason = "";

    if (totalBatchesCooked > maxStandardBatches) {
      isEligible = true;
      overtimeReason = `Produksi ${totalBatchesCooked} adonan melebihi batas standar shift (${maxStandardBatches} adonan untuk ${crewCount} orang)`;
    }
    if (deepCleaning?.isDeepCleaning) {
      isEligible = true;
      overtimeReason = overtimeReason
        ? `${overtimeReason} & Tugas ekstra deep cleaning`
        : `Tugas ekstra deep cleaning dapur: ${deepCleaning.description || "Pembersihan menyeluruh"}`;
    }

    const overtimeClaim = {
      isOvertimeEligible: isEligible || data.overtimeClaim?.isOvertimeEligible || false,
      reason: overtimeReason || data.overtimeClaim?.reason || "",
      status: "pending_owner" as const,
      bonusAmount: data.overtimeClaim?.bonusAmount ?? 0,
    };

    // --- 3. Execute Stock Deductions & Increments via Batch Transaction ---
    const batch = adminDb.batch();

    // A. Deduct Raw Materials from Recipes based on actual cooking
    if (cooking && cooking.targets && cooking.targets.length > 0) {
      // 1. Base recipes (variantId == "all", non-packaging)
      if (totalBatchesCooked > 0) {
        const baseRecipesSnap = await adminDb
          .collection("recipes")
          .where("variantId", "==", "all")
          .get();

        for (const doc of baseRecipesSnap.docs) {
          const r = doc.data();
          // Exclude packaging materials (plastik, stiker) from cooking deduction
          if (r.ingredientId && r.qtyPerBatch && !r.id.startsWith("pkg-")) {
            const qtyNeeded = Number(r.qtyPerBatch) * totalBatchesCooked;
            if (qtyNeeded > 0) {
              const ingRef = adminDb.collection("ingredients").doc(r.ingredientId);
              batch.update(ingRef, {
                currentStock: FieldValue.increment(-qtyNeeded),
                updatedAt: FieldValue.serverTimestamp(),
              });
              const movRef = adminDb.collection("stockMovements").doc();
              batch.set(movRef, {
                ingredientId: r.ingredientId,
                changeAmount: -qtyNeeded,
                sourceType: "shift_report_cooking",
                sourceId: reportRef.id,
                note: `Bahan baku masak ${totalBatchesCooked} adonan (${reportNumber})`,
                createdBy: auth.uid,
                createdAt: FieldValue.serverTimestamp(),
              });
            }
          }
        }
      }

      // 2. Variant specific ingredients (perasa)
      for (const t of cooking.targets) {
        const tBatches = Number(t.batches) || 0;
        if (t.variantId && t.variantId !== "all" && tBatches > 0) {
          const varRecipesSnap = await adminDb
            .collection("recipes")
            .where("variantId", "==", t.variantId)
            .get();

          for (const doc of varRecipesSnap.docs) {
            const r = doc.data();
            if (r.ingredientId && r.qtyPerBatch) {
              const qtyNeeded = Number(r.qtyPerBatch) * tBatches;
              if (qtyNeeded > 0) {
                const ingRef = adminDb.collection("ingredients").doc(r.ingredientId);
                batch.update(ingRef, {
                  currentStock: FieldValue.increment(-qtyNeeded),
                  updatedAt: FieldValue.serverTimestamp(),
                });
                const movRef = adminDb.collection("stockMovements").doc();
                batch.set(movRef, {
                  ingredientId: r.ingredientId,
                  changeAmount: -qtyNeeded,
                  sourceType: "shift_report_cooking",
                  sourceId: reportRef.id,
                  note: `Perasa ${t.variantName} (${reportNumber})`,
                  createdBy: auth.uid,
                  createdAt: FieldValue.serverTimestamp(),
                });
              }
            }
          }
        }

        // 3. Update Freezer Rak Stocks (add cooked trays & pcs)
        const rakRef = adminDb.collection("freezerRakStocks").doc(t.variantId);
        batch.set(
          rakRef,
          {
            variantId: t.variantId,
            variantName: t.variantName,
            totalLoyang: FieldValue.increment(t.loyang || 0),
            totalPcs: FieldValue.increment(t.pcs || 0),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    // B. Handle Thinwall Prepack: deduct from Freezer Rak, add to Freezer Peti (productStocks)
    if (prepack && prepack.items && prepack.items.length > 0) {
      for (const p of prepack.items) {
        const regPacks = Number(p.regularPacks) || 0;
        const fullPacks = Number(p.fullPacks) || 0;
        const lUsed = Number(p.loyangUsed) || 0;

        // Deduct loyang from Freezer Rak
        if (lUsed > 0 || (regPacks > 0 || fullPacks > 0)) {
          const approxPcsDeducted = (regPacks * 12) + (fullPacks * 16);
          const rakRef = adminDb.collection("freezerRakStocks").doc(p.variantId);
          batch.set(
            rakRef,
            {
              variantId: p.variantId,
              variantName: p.variantName,
              totalLoyang: FieldValue.increment(-lUsed),
              totalPcs: FieldValue.increment(-approxPcsDeducted),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }

        // Add regular packs to productStocks
        if (regPacks > 0) {
          const regStockId = `churros-frozen-regular_${p.variantId}`;
          const rRef = adminDb.collection("productStocks").doc(regStockId);
          batch.set(
            rRef,
            {
              productId: "churros-frozen-regular",
              variantId: p.variantId,
              currentStock: FieldValue.increment(regPacks),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          const mRef = adminDb.collection("stockMovements").doc();
          batch.set(mRef, {
            ingredientId: `product:${regStockId}`,
            changeAmount: regPacks,
            sourceType: "shift_report_prepack",
            sourceId: reportRef.id,
            note: `Hasil prepack regular ${p.variantName} (${reportNumber})`,
            createdBy: auth.uid,
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        // Add full packs to productStocks
        if (fullPacks > 0) {
          const fullStockId = `churros-frozen-full_${p.variantId}`;
          const fRef = adminDb.collection("productStocks").doc(fullStockId);
          batch.set(
            fRef,
            {
              productId: "churros-frozen-full",
              variantId: p.variantId,
              currentStock: FieldValue.increment(fullPacks),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          const mRef = adminDb.collection("stockMovements").doc();
          batch.set(mRef, {
            ingredientId: `product:${fullStockId}`,
            changeAmount: fullPacks,
            sourceType: "shift_report_prepack",
            sourceId: reportRef.id,
            note: `Hasil prepack full ${p.variantName} (${reportNumber})`,
            createdBy: auth.uid,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      }

      // Deduct thinwall & sticker packaging materials
      if (totalThinwallPacks > 0) {
        const pkgSnap = await adminDb.collection("packagingRecipes").get();
        for (const doc of pkgSnap.docs) {
          const packData = doc.data();
          const qtyNeeded = (Number(packData.qtyPerPack) || 1) * totalThinwallPacks;
          if (packData.ingredientId && qtyNeeded > 0) {
            batch.update(adminDb.collection("ingredients").doc(packData.ingredientId), {
              currentStock: FieldValue.increment(-qtyNeeded),
            });
            batch.set(adminDb.collection("stockMovements").doc(), {
              ingredientId: packData.ingredientId,
              changeAmount: -qtyNeeded,
              sourceType: "shift_report_packaging",
              sourceId: reportRef.id,
              note: `Kemasan thinwall (${reportNumber})`,
              createdBy: auth.uid,
              createdAt: FieldValue.serverTimestamp(),
            });
          }
        }
      }
    }

    // C. Update physical scale remaining materials
    if (data.rawMaterialRemaining && data.rawMaterialRemaining.length > 0) {
      for (const item of data.rawMaterialRemaining) {
        if (item.ingredientId && item.physicalStock !== undefined) {
          const ingRef = adminDb.collection("ingredients").doc(item.ingredientId);
          batch.set(
            ingRef,
            {
              currentStock: item.physicalStock,
              lastOpnameAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          const mRef = adminDb.collection("stockMovements").doc();
          batch.set(mRef, {
            ingredientId: item.ingredientId,
            changeAmount: 0,
            newStockAfter: item.physicalStock,
            sourceType: "shift_closing_opname",
            sourceId: reportRef.id,
            note: `Timbangan sisa shift kru: ${item.name} = ${item.physicalStock} ${item.unit} (${reportNumber})`,
            createdBy: auth.uid,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      }
    }

    // D. Create Work Order Audit Record (status: COMPLETED)
    const woRef = adminDb.collection("workOrders").doc();
    const woPayload = {
      woNumber: `WO-${dateCompact}-${woRef.id.slice(0, 4).toUpperCase()}`,
      woType: "SHIFT_REPORT",
      status: "COMPLETED",
      productId: cooking?.targets?.[0]?.variantId || "shift-report",
      productName: cooking?.targets?.map((t) => t.variantName).join(", ") || "Laporan Produksi Shift",
      variantIds: cooking?.targets?.map((t) => t.variantId) || [],
      variantNames: cooking?.targets?.map((t) => t.variantName).join(", ") || "",
      targetBatches: totalBatchesCooked,
      targetLoyang: totalLoyangCooked,
      targetPacks: totalThinwallPacks,
      targetPcs: totalPcsCooked,
      currentStage: "FINAL_PACK",
      summaryState: {
        totalDoughBatchesDone: totalBatchesCooked,
        totalTrayPrinted: totalLoyangCooked,
        totalTrayInFreezer: totalLoyangCooked,
        totalGoodPacks: totalThinwallPacks,
        totalGoodPcs: totalPcsCooked,
        totalDefectPacks: 0,
        totalDefectPcs: 0,
      },
      createdAt: FieldValue.serverTimestamp(),
      startedAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
      assignedCrewId: data.crewIds[0] || auth.uid,
      assignedCrewIds: data.crewIds,
      assignedCrewName: data.crewNames.join(", "),
      shiftReportId: reportRef.id,
      notes: data.notes || `Laporan Shift ${reportNumber}`,
    };
    batch.set(woRef, woPayload);

    // E. Save Shift Report Document
    const shiftReportDoc = {
      ...data,
      id: reportRef.id,
      reportNumber,
      overtimeClaim,
      speedScore,
      totalDurationMinutes: actualReportedMinutes,
      associatedWorkOrderId: woRef.id,
      createdBy: auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    batch.set(reportRef, shiftReportDoc);

    // Commit all database operations atomically
    await batch.commit();

    // --- 4. Trigger Alerts for Low/Out-of-Stock Flavors ---
    if (data.criticalFlavorsStatus && data.criticalFlavorsStatus.length > 0) {
      for (const item of data.criticalFlavorsStatus) {
        if (item.status === "habis" || item.status === "dikit_lagi") {
          await createSfmAlert({
            type: "ingredient_low_stock",
            severity: item.status === "habis" ? "error" : "warning",
            title: `Bahan ${item.status === "habis" ? "HABIS" : "Menipis"} di Dapur`,
            message: `${item.name} berstatus ${item.status === "habis" ? "Habis" : "Dikit Lagi"} berdasarkan laporan shift ${data.crewNames.join(", ")} (${reportNumber}). Segera jadwalkan belanja.`,
            sourceId: reportRef.id,
          });
        }
      }
    }

    if (isEligible) {
      await createSfmAlert({
        type: "crew_overtime_claim",
        severity: "info",
        title: "Klaim Lemburan Shift Masuk",
        message: `${data.crewNames.join(", ")} mengajukan lembur: ${overtimeReason}. Silakan review di modul Payroll.`,
        sourceId: reportRef.id,
      });
    }

    return NextResponse.json({
      success: true,
      id: reportRef.id,
      reportNumber,
      speedScore,
      isOvertimeEligible: isEligible,
      workOrderId: woRef.id,
    });
  } catch (err) {
    console.error("POST /api/sfm/shift-reports error:", err);
    return NextResponse.json({ error: "Gagal memproses laporan shift" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const month = searchParams.get("month"); // YYYY-MM
  const crewId = searchParams.get("crewId");
  const limitParam = parseInt(searchParams.get("limit") || "30");

  try {
    let query: FirebaseFirestore.Query = adminDb
      .collection("shiftReports")
      .orderBy("createdAt", "desc")
      .limit(limitParam);

    if (date) {
      query = query.where("date", "==", date);
    } else if (month) {
      query = query.where("date", ">=", `${month}-01`).where("date", "<=", `${month}-31`);
    }

    const snap = await query.get();
    let records = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        reportNumber: d.reportNumber || doc.id,
        date: d.date,
        shiftMode: d.shiftMode || "solo",
        crewIds: d.crewIds || [],
        crewNames: d.crewNames || [],
        picDapurName: d.picDapurName || null,
        picPackingName: d.picPackingName || null,
        photoUrls: d.photoUrls || [],
        activities: d.activities || {},
        rawMaterialRemaining: d.rawMaterialRemaining || [],
        criticalFlavorsStatus: d.criticalFlavorsStatus || [],
        overtimeClaim: d.overtimeClaim || { isOvertimeEligible: false, reason: "", status: "pending_owner" },
        notes: d.notes || "",
        speedScore: d.speedScore ?? 100,
        totalDurationMinutes: d.totalDurationMinutes ?? 0,
        associatedWorkOrderId: d.associatedWorkOrderId || null,
        createdAt: d.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      };
    });

    if (crewId) {
      records = records.filter((r) => r.crewIds.includes(crewId));
    }

    return NextResponse.json(records);
  } catch (err) {
    console.error("GET /api/sfm/shift-reports error:", err);
    return NextResponse.json({ error: "Gagal mengambil data laporan shift" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload JSON tidak valid" }, { status: 400 });
  }

  const { id, overtimeStatus, ownerNote } = body;
  if (!id) {
    return NextResponse.json({ error: "ID laporan wajib disertakan" }, { status: 400 });
  }

  try {
    const reportRef = adminDb.collection("shiftReports").doc(id);
    const doc = await reportRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Laporan shift tidak ditemukan" }, { status: 404 });
    }

    const updates: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };
    if (overtimeStatus) {
      updates["overtimeClaim.status"] = overtimeStatus;
    }
    if (ownerNote !== undefined) {
      updates["overtimeClaim.ownerNote"] = ownerNote;
    }

    await reportRef.update(updates);
    return NextResponse.json({ success: true, message: "Status lembur berhasil diperbarui" });
  } catch (err) {
    console.error("PATCH /api/sfm/shift-reports error:", err);
    return NextResponse.json({ error: "Gagal memperbarui status lembur" }, { status: 500 });
  }
}
