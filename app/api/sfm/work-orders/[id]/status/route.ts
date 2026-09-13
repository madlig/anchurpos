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
    const { status } = body;

    const woRef = adminDb.collection("workOrders").doc(workOrderId);
    const woSnap = await woRef.get();

    if (!woSnap.exists) {
      return NextResponse.json({ error: "Work Order tidak ditemukan" }, { status: 404 });
    }

    const woData = woSnap.data()!;
    const oldStatus = woData.status;

    const updates: Record<string, any> = { status };

    if (status === "IN_PROGRESS" && !woData.startedAt) {
      updates.startedAt = FieldValue.serverTimestamp();
    }

    if (status === "COMPLETED") {
      updates.completedAt = FieldValue.serverTimestamp();
    }

    // Restore BOM raw materials if Work Order is CANCELLED
    if (status === "CANCELLED" && oldStatus !== "CANCELLED") {
      if (woData.woType === "PRODUKSI" || !woData.woType) {
        try {
          const ingredientRestores = new Map<string, number>();

          if (woData.productionTargets && Array.isArray(woData.productionTargets) && woData.productionTargets.length > 0) {
            const totalBatches = woData.productionTargets.reduce((sum: number, t: any) => sum + (Number(t.targetBatches) || 0), 0);
            if (totalBatches > 0) {
              const baseRecipesSnap = await adminDb.collection("recipes").where("variantId", "==", "all").get();
              for (const doc of baseRecipesSnap.docs) {
                const r = doc.data();
                if (r.ingredientId && r.qtyPerBatch) {
                  const qty = Number(r.qtyPerBatch) * totalBatches;
                  ingredientRestores.set(r.ingredientId, (ingredientRestores.get(r.ingredientId) || 0) + qty);
                }
              }
            }

            for (const target of woData.productionTargets) {
              const tBatches = Number(target.targetBatches) || 0;
              if (target.variantId && target.variantId !== "all" && tBatches > 0) {
                const varRecipesSnap = await adminDb.collection("recipes").where("variantId", "==", target.variantId).get();
                for (const doc of varRecipesSnap.docs) {
                  const r = doc.data();
                  if (r.ingredientId && r.qtyPerBatch) {
                    const qty = Number(r.qtyPerBatch) * tBatches;
                    ingredientRestores.set(r.ingredientId, (ingredientRestores.get(r.ingredientId) || 0) + qty);
                  }
                }
              }
            }
          } else {
            const effectiveBatches = Number(woData.targetBatches) || 1;
            const vId = (Array.isArray(woData.variantIds) && woData.variantIds[0]) || "original";
            const recipesSnap = await adminDb.collection("recipes").where("variantId", "in", ["all", vId]).get();
            for (const doc of recipesSnap.docs) {
              const r = doc.data();
              if (r.ingredientId && r.qtyPerBatch) {
                const qty = Number(r.qtyPerBatch) * effectiveBatches;
                ingredientRestores.set(r.ingredientId, (ingredientRestores.get(r.ingredientId) || 0) + qty);
              }
            }
          }

          for (const [ingId, qtyToRestore] of ingredientRestores.entries()) {
            if (qtyToRestore > 0) {
              const ingRef = adminDb.collection("ingredients").doc(ingId);
              const ingSnap = await ingRef.get();
              if (ingSnap.exists) {
                const curr = ingSnap.data()?.currentStock ?? 0;
                const newStock = curr + qtyToRestore;
                await ingRef.update({
                  currentStock: FieldValue.increment(qtyToRestore),
                });

                await adminDb.collection("stockMovements").add({
                  ingredientId: ingId,
                  changeAmount: qtyToRestore,
                  newStockAfter: newStock,
                  sourceType: "production_reversal",
                  sourceId: woRef.id,
                  note: `Restorasi BOM WO #${woData.woNumber} (CANCELLED)`,
                  createdBy: auth.uid,
                  createdAt: FieldValue.serverTimestamp(),
                });
              }
            }
          }
        } catch (restoreErr) {
          console.warn("BOM Restoration notice:", restoreErr);
        }
      }
    }

    await woRef.update(updates);

    return NextResponse.json({ success: true, status });
  } catch (err) {
    console.error("PATCH /api/sfm/work-orders/[id]/status error:", err);
    return NextResponse.json({ error: "Gagal memperbarui status Work Order" }, { status: 500 });
  }
}
