import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-middleware";
import { FieldValue } from "firebase-admin/firestore";
import type { WorkOrder } from "@/types";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const taskId = params.id;
  try {
    const taskRef = adminDb.collection("tasks").doc(taskId);
    const snap = await taskRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Tugas tidak ditemukan" }, { status: 404 });
    }

    const task = snap.data() as WorkOrder;
    if (task.status === "done") {
      return NextResponse.json({ error: "Tugas sudah diselesaikan sebelumnya" }, { status: 400 });
    }

    const { status } = await req.json();
    if (status !== "done") {
      return NextResponse.json({ error: "Invalid status update" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const batch = adminDb.batch();

    // 1. Mark task as done
    batch.update(taskRef, {
      status: "done",
      completedAt: now,
      completedBy: auth.uid,
    });

    // 2. Jika tipe tugas = produksi, jalankan logika potong stok BOM (MVP Opsi B / Integrasi Produksi)
    if (task.type === "produksi" && task.productionData) {
      const { variantId, batches } = task.productionData;
      // Ambil recipe (BOM) untuk produk ini
      const recipeSnap = await adminDb.collection("recipes").where("variantId", "==", variantId).get();
      if (!recipeSnap.empty) {
        const recipe = recipeSnap.docs[0].data();
        // Potong bahan baku (BOM * batches)
        if (recipe.ingredients) {
          for (const ing of recipe.ingredients) {
            const ingRef = adminDb.collection("ingredients").doc(ing.ingredientId);
            const qtyToDeduct = ing.quantity * batches;
            batch.update(ingRef, {
              currentStock: FieldValue.increment(-qtyToDeduct),
              updatedAt: now,
            });
            // Catat pergerakan stok
            const moveRef = adminDb.collection("stockMovements").doc();
            batch.set(moveRef, {
              ingredientId: ing.ingredientId,
              itemType: "ingredient",
              changeAmount: -qtyToDeduct,
              source: "production",
              timestamp: now,
              userId: auth.uid,
              userName: auth.name,
              notes: `Produksi ${batches} batch (Tugas: ${task.title})`
            });
          }
        }
      }
      
      // Tambah stok barang jadi (Variant)
      const variantRef = adminDb.collection("variants").doc(variantId);
      // Asumsi 1 batch = 16 pack (Bisa diatur di master data, untuk MVP hardcode 16 atau ambil dari packPerBatch)
      // Ambil packPerBatch dari Product
      const variantSnap = await variantRef.get();
      let yieldPerBatch = 16;
      if (variantSnap.exists) {
         const vData = variantSnap.data();
         if (vData?.productId) {
            const prodSnap = await adminDb.collection("products").doc(vData.productId).get();
            if (prodSnap.exists) {
               yieldPerBatch = prodSnap.data()?.packPerBatch || 16;
            }
         }
      }
      const totalProduced = yieldPerBatch * batches;
      
      batch.update(variantRef, {
        currentStock: FieldValue.increment(totalProduced),
        updatedAt: now
      });
      // Catat pergerakan stok varian
      const vMoveRef = adminDb.collection("stockMovements").doc();
      batch.set(vMoveRef, {
        ingredientId: variantId,
        itemType: "variant",
        changeAmount: totalProduced,
        source: "production",
        timestamp: now,
        userId: auth.uid,
        userName: auth.name,
        notes: `Hasil Produksi ${batches} batch (Tugas: ${task.title})`
      });
    }

    // Eksekusi Batch
    await batch.commit();

    return NextResponse.json({ success: true, completedAt: now });
  } catch (error: any) {
    console.error("PATCH Tasks error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
