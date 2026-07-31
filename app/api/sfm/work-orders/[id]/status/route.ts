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
      try {
        const recipeSnap = await adminDb.collection("recipes").where("productId", "==", woData.productId || "churros-frozen-food").get();
        if (!recipeSnap.empty) {
          const recipeData = recipeSnap.docs[0].data();
          const ingredientsToRestore = recipeData.ingredients || [];
          const numBatches = woData.targetBatches || 1;

          for (const ing of ingredientsToRestore) {
            const qtyToRestore = (ing.amount || 0) * numBatches;
            if (ing.ingredientId && qtyToRestore > 0) {
              const ingRef = adminDb.collection("ingredients").doc(ing.ingredientId);
              await ingRef.update({
                stock: FieldValue.increment(qtyToRestore),
              });
            }
          }
        }
      } catch (restoreErr) {
        console.warn("BOM Restoration notice:", restoreErr);
      }
    }

    await woRef.update(updates);

    return NextResponse.json({ success: true, status });
  } catch (err) {
    console.error("PATCH /api/sfm/work-orders/[id]/status error:", err);
    return NextResponse.json({ error: "Gagal memperbarui status Work Order" }, { status: 500 });
  }
}
