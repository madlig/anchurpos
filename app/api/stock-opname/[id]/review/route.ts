import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import { FieldValue } from "firebase-admin/firestore";
import { stockOpnameReviewSchema } from "@/lib/validations";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 });
  }

  const parseResult = stockOpnameReviewSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Data review tidak valid", details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { reviewNote, adjustments } = parseResult.data;

  try {
    const opnameSnap = await adminDb.doc(`stockOpname/${id}`).get();
    if (!opnameSnap.exists) {
      return NextResponse.json({ error: "Opname tidak ditemukan" }, { status: 404 });
    }

    const opnameData = opnameSnap.data()!;
    if (opnameData.reviewedBy) {
      return NextResponse.json({ error: "Opname sudah direview" }, { status: 400 });
    }

    const opnameItems = (opnameData.items || []) as {
      ingredientId: string;
      itemType?: string;
      name?: string;
      unit?: string;
      inputMethod: string;
      physicalStock: number | null;
      physicalStockConverted: number | null;
      systemStock: number;
      difference: number;
    }[];

    let adjustmentsApplied = 0;

    await adminDb.runTransaction(async (tx) => {
      for (const adj of adjustments ?? []) {
        if (!adj.applyAdjustment) continue;

        const opnameItem = opnameItems.find(
          (i) => i.ingredientId === adj.ingredientId
        );
        if (!opnameItem) continue;

        const physicalValue =
          opnameItem.inputMethod === "packaged"
            ? opnameItem.physicalStockConverted
            : opnameItem.physicalStock;

        if (physicalValue === null || physicalValue === undefined) continue;

        const isVariant = opnameItem.itemType === "variant";

        if (isVariant) {
          const productStockRef = adminDb.collection("productStocks").doc(adj.ingredientId);
          const pSnap = await tx.get(productStockRef);
          const currentStock = pSnap.exists ? (pSnap.data()?.currentStock ?? 0) : 0;
          const changeAmount = physicalValue - currentStock;

          tx.set(
            productStockRef,
            {
              currentStock: physicalValue,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          const movementRef = adminDb.collection("stockMovements").doc();
          tx.set(movementRef, {
            ingredientId: `product:${adj.ingredientId}`,
            changeAmount,
            newStockAfter: physicalValue,
            sourceType: "stock_opname_adjustment",
            sourceId: id,
            note: reviewNote ?? "Penyesuaian dari review opname produk jadi",
            createdBy: auth.uid,
            createdAt: FieldValue.serverTimestamp(),
          });

          adjustmentsApplied++;
        } else {
          const ingredientRef = adminDb.doc(`ingredients/${adj.ingredientId}`);
          const ingredientSnap = await tx.get(ingredientRef);

          if (!ingredientSnap.exists) {
            // Fallback: check productStocks if itemType was omitted
            const fallbackPRef = adminDb.collection("productStocks").doc(adj.ingredientId);
            const fallbackPSnap = await tx.get(fallbackPRef);
            if (fallbackPSnap.exists) {
              const currentStock = fallbackPSnap.data()?.currentStock ?? 0;
              const changeAmount = physicalValue - currentStock;

              tx.set(
                fallbackPRef,
                {
                  currentStock: physicalValue,
                  updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true }
              );

              const movementRef = adminDb.collection("stockMovements").doc();
              tx.set(movementRef, {
                ingredientId: `product:${adj.ingredientId}`,
                changeAmount,
                newStockAfter: physicalValue,
                sourceType: "stock_opname_adjustment",
                sourceId: id,
                note: reviewNote ?? "Penyesuaian dari review opname produk jadi",
                createdBy: auth.uid,
                createdAt: FieldValue.serverTimestamp(),
              });

              adjustmentsApplied++;
              continue;
            }
            continue;
          }

          const currentStock = ingredientSnap.data()!.currentStock ?? 0;
          const changeAmount = physicalValue - currentStock;

          tx.update(ingredientRef, { currentStock: physicalValue });

          const movementRef = adminDb.collection("stockMovements").doc();
          tx.set(movementRef, {
            ingredientId: adj.ingredientId,
            changeAmount,
            newStockAfter: physicalValue,
            sourceType: "stock_opname_adjustment",
            sourceId: id,
            note: reviewNote ?? "Penyesuaian dari review opname bahan",
            createdBy: auth.uid,
            createdAt: FieldValue.serverTimestamp(),
          });

          adjustmentsApplied++;
        }
      }

      tx.update(opnameSnap.ref, {
        reviewedBy: auth.uid,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewAction: adjustmentsApplied > 0 ? "adjusted" : "acknowledge",
      });
    });

    return NextResponse.json({
      success: true,
      adjustmentsApplied,
      reviewAction: adjustmentsApplied > 0 ? "adjusted" : "acknowledge",
    });
  } catch (err) {
    console.error("PATCH /api/stock-opname/[id]/review error:", err);
    return NextResponse.json({ error: "Gagal mereview opname" }, { status: 500 });
  }
}
