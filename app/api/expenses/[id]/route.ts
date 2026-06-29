import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const expenseRef = adminDb.collection("expenses").doc(id);

    await adminDb.runTransaction(async (tx) => {
      const expSnap = await tx.get(expenseRef);
      if (!expSnap.exists) {
        throw new Error("Pengeluaran tidak ditemukan");
      }

      const expData = expSnap.data()!;
      const ingredientId = expData.ingredientId ?? null;
      const qtyInBaseUnit = expData.qtyInBaseUnit ?? 0;

      // Jika ini adalah pengeluaran bahan baku, kurangi kembali stoknya
      if (ingredientId && qtyInBaseUnit > 0) {
        const ingRef = adminDb.collection("ingredients").doc(ingredientId);
        const ingSnap = await tx.get(ingRef);
        
        if (ingSnap.exists) {
          const currentStock = ingSnap.data()?.currentStock ?? 0;
          const newStock = Math.max(0, currentStock - qtyInBaseUnit);
          
          tx.update(ingRef, { currentStock: newStock });

          // Catat stock movement pembatalan
          const movementRef = adminDb.collection("stockMovements").doc();
          tx.set(movementRef, {
            ingredientId,
            changeAmount: -qtyInBaseUnit,
            newStockAfter: newStock,
            sourceType: "expense_revert",
            sourceId: id,
            note: `Pembatalan pengeluaran: ${expData.itemName}`,
            createdBy: auth.uid,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      }

      // Hapus dokumen pengeluaran
      tx.delete(expenseRef);
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/expenses/[id] error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal membatalkan transaksi pengeluaran" },
      { status: 500 }
    );
  }
}
