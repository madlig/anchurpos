import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole, AuthUser } from "@/lib/auth-middleware";

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  try {
    const body = await req.json();
    const { targetItemId, yieldQty, date } = body as {
      targetItemId: string;
      yieldQty: number;
      date?: string;
    };

    if (!targetItemId || !yieldQty || yieldQty <= 0) {
      return NextResponse.json({ error: "Item target dan kuantitas hasil kemas wajib diisi (> 0)" }, { status: 400 });
    }

    const dateToUse = date ? new Date(date) : new Date();

    // 1. Fetch Resep Pre-pack untuk targetItemId
    const recipeSnap = await adminDb
      .collection("prepackRecipes")
      .where("targetItemId", "==", targetItemId)
      .get();

    if (recipeSnap.empty) {
      return NextResponse.json({ error: "Resep BOM pre-pack untuk item ini belum diatur oleh Manager" }, { status: 400 });
    }

    const recipeItems = recipeSnap.docs.map(doc => doc.data() as { ingredientId: string; qtyPerPack: number; unit: string });

    await adminDb.runTransaction(async (tx) => {
      // Fetch target item
      const targetRef = adminDb.collection("ingredients").doc(targetItemId);
      const targetSnap = await tx.get(targetRef);
      if (!targetSnap.exists) throw new Error("Item target hasil kemas tidak ditemukan di database");
      const targetData = targetSnap.data()!;

      // Fetch all required raw materials & packaging
      const ingRefs = recipeItems.map(r => adminDb.collection("ingredients").doc(r.ingredientId));
      const ingSnaps = await Promise.all(ingRefs.map(ref => tx.get(ref)));

      // Check existence & deduct stock for raw materials
      const deductions: Array<{ ref: FirebaseFirestore.DocumentReference; name: string; unit: string; usedQty: number; newStock: number }> = [];

      for (let idx = 0; idx < recipeItems.length; idx++) {
        const rItem = recipeItems[idx];
        const ingSnap = ingSnaps[idx];
        if (!ingSnap.exists) throw new Error(`Bahan/Kemasan dengan ID ${rItem.ingredientId} tidak ditemukan`);
        
        const ingData = ingSnap.data()!;
        const usedQty = rItem.qtyPerPack * yieldQty;
        const currentStock = ingData.currentStock ?? 0;
        const newStock = currentStock - usedQty;

        deductions.push({
          ref: ingSnap.ref,
          name: ingData.name,
          unit: ingData.baseUnit || rItem.unit,
          usedQty,
          newStock
        });
      }

      // Execute Deductions
      for (const ded of deductions) {
        tx.update(ded.ref, { currentStock: ded.newStock, updatedAt: new Date().toISOString() });

        // Record stock movement OUT for ingredient
        const movRef = adminDb.collection("stockMovements").doc();
        tx.set(movRef, {
          date: dateToUse,
          itemId: ded.ref.id,
          itemName: ded.name,
          type: "repack_out",
          qty: -ded.usedQty,
          unit: ded.unit,
          reason: `Repack ke ${targetData.name} (${yieldQty} ${targetData.baseUnit || 'pack'})`,
          notes: `Dipakai ${ded.usedQty} ${ded.unit}`,
          createdBy: user.uid,
          createdAt: new Date().toISOString()
        });
      }

      // Execute Addition to Target Item Stock
      const newTargetStock = (targetData.currentStock ?? 0) + Number(yieldQty);
      tx.update(targetRef, { currentStock: newTargetStock, updatedAt: new Date().toISOString() });

      // Record stock movement IN for Target Item
      const targetMovRef = adminDb.collection("stockMovements").doc();
      tx.set(targetMovRef, {
        date: dateToUse,
        itemId: targetItemId,
        itemName: targetData.name,
        type: "repack_in",
        qty: Number(yieldQty),
        unit: targetData.baseUnit || "pack",
        reason: `Hasil Repack Pre-Packing`,
        notes: `Bertambah ${yieldQty} ${targetData.baseUnit || 'pack'}`,
        createdBy: user.uid,
        createdAt: new Date().toISOString()
      });
    });

    return NextResponse.json({ message: "Repacking / Pre-packing berhasil diproses!" });
  } catch (error: any) {
    console.error("POST /api/inventory/repack error:", error);
    return NextResponse.json({ error: error.message || "Gagal memproses repack" }, { status: 500 });
  }
}
