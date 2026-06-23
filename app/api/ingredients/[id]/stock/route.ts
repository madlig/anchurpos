import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  const { id } = await params;
  const body = await req.json();
  const { newStock, note } = body;

  if (typeof newStock !== "number" || newStock < 0) {
    return NextResponse.json({ error: "newStock harus angka >= 0" }, { status: 400 });
  }

  try {
    let changeAmount = 0;

    await adminDb.runTransaction(async (tx) => {
      const ingRef = adminDb.collection("ingredients").doc(id);
      const ingSnap = await tx.get(ingRef);

      if (!ingSnap.exists) {
        throw new Error("NOT_FOUND");
      }

      const currentStock = ingSnap.data()!.currentStock ?? 0;
      changeAmount = newStock - currentStock;

      tx.update(ingRef, { currentStock: newStock });

      const movementRef = adminDb.collection("stockMovements").doc();
      tx.set(movementRef, {
        ingredientId: id,
        changeAmount,
        newStockAfter: newStock,
        sourceType: "manual_edit",
        sourceId: null,
        note: note ?? null,
        createdBy: user.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ success: true, changeAmount });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Bahan tidak ditemukan" }, { status: 404 });
    }
    console.error("PATCH /api/ingredients/[id]/stock error:", err);
    return NextResponse.json({ error: "Gagal update stok" }, { status: 500 });
  }
}
