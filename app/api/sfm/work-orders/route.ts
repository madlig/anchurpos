import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const woType = searchParams.get("woType");
  const dateStr = searchParams.get("date");
  const variantId = searchParams.get("variantId");
  const search = searchParams.get("search");

  try {
    const [woSnap, legacySnap, varSnap] = await Promise.all([
      adminDb.collection("workOrders").orderBy("createdAt", "desc").get(),
      adminDb.collection("productions").orderBy("date", "desc").get(),
      adminDb.collection("variants").get(),
    ]);

    const varMap: Record<string, string> = {};
    varSnap.docs.forEach(doc => {
      const d = doc.data();
      varMap[doc.id] = d.name || "Churros Frozen";
    });

    let workOrders = woSnap.docs.map((doc) => {
      const d = doc.data();
      const targetPacks = d.targetPacks || 50;
      const targetPcs = d.targetPcs || targetPacks * 12; // 1 Pack = 12 Pcs Base UoM

      return {
        id: doc.id,
        woNumber: d.woNumber || `WO-${doc.id.slice(0, 6).toUpperCase()}`,
        woType: d.woType || "PRODUKSI",
        productId: d.productId || "",
        productName: d.productName || "Churros Frozen",
        variantIds: d.variantIds || [],
        variantNames: (d.variantIds || []).map((vId: string) => varMap[vId] || vId).join(", "),
        targetBatches: d.targetBatches || 0,
        targetLoyang: d.targetLoyang || 0,
        targetPacks: targetPacks,
        targetPcs: targetPcs,
        targetQty: d.targetQty || 0,
        targetUom: d.targetUom || "",
        status: d.status || "PLANNED",
        currentStage: d.currentStage || "DOUGH_COOKING",
        summaryState: d.summaryState || {
          totalDoughBatchesDone: 0,
          totalTrayPrinted: 0,
          totalTrayInFreezer: 0,
          totalGoodPacks: 0,
          totalGoodPcs: 0,
          totalDefectPacks: 0,
          totalDefectPcs: 0,
        },
        stepDurationsMinutes: d.stepDurationsMinutes || {},
        createdAt: d.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        startedAt: d.startedAt?.toDate?.().toISOString() ?? undefined,
        freezerInAt: d.freezerInAt?.toDate?.().toISOString() ?? undefined,
        completedAt: d.completedAt?.toDate?.().toISOString() ?? undefined,
        assignedCrewId: d.assignedCrewId || "",
        assignedCrewName: d.assignedCrewName || "Crew Dapur",
        notes: d.notes || "",
        batchCode: d.batchCode || "",
        expiredDate: d.expiredDate || "",
      };
    });

    // Map legacy productions to WorkOrder format for 100% backward compatibility
    const legacyWorkOrders = legacySnap.docs.map((doc) => {
      const d = doc.data();
      const createdAt = d.date?.toDate?.().toISOString() ?? d.createdAt?.toDate?.().toISOString() ?? new Date().toISOString();
      const vName = varMap[d.variantId] || "Churros Frozen";
      const loyang = d.loyangCount || 0;
      const batches = d.batches || 1;
      const pcs = d.pcsCount || (loyang * 16) || 196;
      const packs = Math.floor(pcs / 12);

      return {
        id: `legacy-${doc.id}`,
        woNumber: `WO-${doc.id.slice(0, 6).toUpperCase()}`,
        woType: "PRODUKSI",
        productId: d.variantId || "legacy-churros",
        productName: `Churros (${vName})`,
        variantIds: d.variantId ? [d.variantId] : [],
        variantNames: vName,
        targetBatches: batches,
        targetLoyang: loyang || 12,
        targetPacks: packs || 16,
        targetPcs: pcs,
        status: "COMPLETED",
        currentStage: "FINAL_PACK",
        summaryState: {
          totalDoughBatchesDone: batches,
          totalTrayPrinted: loyang,
          totalTrayInFreezer: d.loyangRemaining || 0,
          totalGoodPacks: packs,
          totalGoodPcs: pcs,
          totalDefectPacks: 0,
          totalDefectPcs: 0,
        },
        stepDurationsMinutes: { DOUGH_COOKING: 25, MIXING_EGG: 15, TRAY_MOLDING: 30, FINAL_PACK: 20 },
        createdAt,
        startedAt: createdAt,
        completedAt: createdAt,
        assignedCrewId: d.shiftCrewId || "",
        assignedCrewName: "Crew Dapur",
        notes: d.notes || "Rekam Produksi Histori",
        batchCode: `CHR-LEGACY-${doc.id.slice(0, 4).toUpperCase()}`,
        expiredDate: "",
      };
    });

    let allWorkOrders = [...workOrders, ...legacyWorkOrders];

    if (status) {
      allWorkOrders = allWorkOrders.filter(w => w.status === status);
    }

    if (woType) {
      allWorkOrders = allWorkOrders.filter(w => w.woType === woType);
    }

    if (dateStr) {
      allWorkOrders = allWorkOrders.filter(w => w.createdAt.startsWith(dateStr));
    }

    if (variantId) {
      allWorkOrders = allWorkOrders.filter(w => w.variantIds.includes(variantId) || w.productId === variantId);
    }

    if (search) {
      const q = search.toLowerCase();
      allWorkOrders = allWorkOrders.filter(w => 
        w.woNumber.toLowerCase().includes(q) || 
        w.productName.toLowerCase().includes(q) || 
        (w.variantNames && w.variantNames.toLowerCase().includes(q))
      );
    }

    return NextResponse.json(allWorkOrders);
  } catch (err) {
    console.error("GET /api/sfm/work-orders error:", err);
    return NextResponse.json({ error: "Gagal mengambil data Work Order" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  try {
    const body = await req.json();
    const { woType, productId, productName, variantIds, targetBatches, targetLoyang, targetPacks, targetPcs, targetQty, targetUom, notes, assignedCrewId } = body;

    const typePrefix = woType === "REPACK_SAOS" ? "RPK" : woType === "STOCK_OPNAME" ? "SOP" : woType === "GENERAL_TASK" ? "TSK" : woType === "PACKING_PESANAN" ? "PCK" : "WO";
    const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(10 + Math.random() * 90);
    const woNumber = `${typePrefix}-${todayStr}-${randomSuffix}`;

    const numBatches = Number(targetBatches) || 0;
    const numLoyang = Number(targetLoyang) || (numBatches * 12);
    const numPacks = Number(targetPacks) || 0;
    const numPcs = Number(targetPcs) || (numPacks * 12);

    const woRef = adminDb.collection("workOrders").doc();
    const newWo = {
      woNumber,
      woType: woType || "PRODUKSI",
      productId: productId || "churros-frozen-food",
      productName: productName || "Churros Frozen Food",
      variantIds: Array.isArray(variantIds) ? variantIds : [],
      targetBatches: numBatches,
      targetLoyang: numLoyang,
      targetPacks: numPacks,
      targetPcs: numPcs,
      targetQty: Number(targetQty) || 0,
      targetUom: targetUom || "",
      status: "RELEASED", // Released by manager to shop floor
      currentStage: "DOUGH_COOKING",
      summaryState: {
        totalDoughBatchesDone: 0,
        totalTrayPrinted: 0,
        totalTrayInFreezer: 0,
        totalGoodPacks: 0,
        totalGoodPcs: 0,
        totalDefectPacks: 0,
        totalDefectPcs: 0,
      },
      stepDurationsMinutes: {},
      createdAt: FieldValue.serverTimestamp(),
      assignedCrewId: assignedCrewId || user.uid,
      assignedCrewName: user.email || "Crew Dapur",
      notes: notes || "",
    };

    await woRef.set(newWo);

    // Auto-deduct raw material ingredients from BOM recipes upon Work Order release
    try {
      const recipeSnap = await adminDb.collection("recipes").where("productId", "==", productId || "churros-frozen-food").get();
      if (!recipeSnap.empty) {
        const recipeData = recipeSnap.docs[0].data();
        const ingredientsNeeded = recipeData.ingredients || [];

        for (const ing of ingredientsNeeded) {
          const qtyNeeded = (ing.amount || 0) * numBatches;
          if (ing.ingredientId && qtyNeeded > 0) {
            const ingRef = adminDb.collection("ingredients").doc(ing.ingredientId);
            await ingRef.update({
              stock: FieldValue.increment(-qtyNeeded),
            });
          }
        }
      }
    } catch (recipeErr) {
      console.warn("BOM Auto-deduction notice:", recipeErr);
    }

    return NextResponse.json({ success: true, id: woRef.id, woNumber });
  } catch (err) {
    console.error("POST /api/sfm/work-orders error:", err);
    return NextResponse.json({ error: "Gagal membuat Work Order" }, { status: 500 });
  }
}
