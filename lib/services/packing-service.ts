import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { BUSINESS } from "@/lib/constants";

export async function repackGlaze(flavorId: string, targetType: "cup" | "tiktok", cupQty: number, userId: string) {
  const bulkId = `glaze-${flavorId}-bulk`;
  const cupId = targetType === "cup" ? `saus-${flavorId}` : `saus-${flavorId}-tiktok`;
  const conversionGrams = targetType === "cup" ? BUSINESS.GLAZE_CUP_GRAMS : BUSINESS.GLAZE_TIKTOK_GRAMS;
  const totalBulkQty = cupQty * conversionGrams;

  const bulkRef = adminDb.collection("ingredients").doc(bulkId);
  const cupRef = adminDb.collection("ingredients").doc(cupId);

  await adminDb.runTransaction(async (tx) => {
    const bulkSnap = await tx.get(bulkRef);
    const cupSnap = await tx.get(cupRef);

    if (!bulkSnap.exists) throw new Error(`Bahan bulk "${bulkId}" tidak ditemukan`);
    if (!cupSnap.exists) throw new Error(`Bahan target "${cupId}" tidak ditemukan`);

    const bulkStock = bulkSnap.data()?.currentStock ?? 0;
    const cupStock = cupSnap.data()?.currentStock ?? 0;

    if (bulkStock < totalBulkQty) {
      throw new Error(`Stok curah ${bulkSnap.data()?.name} tidak mencukupi (tersedia: ${bulkStock}g, dibutuhkan: ${totalBulkQty}g)`);
    }

    const nextBulkStock = bulkStock - totalBulkQty;
    const nextCupStock = cupStock + cupQty;

    tx.update(bulkRef, { currentStock: nextBulkStock });
    tx.update(cupRef, { currentStock: nextCupStock });

    const movementBulkRef = adminDb.collection("stockMovements").doc();
    tx.set(movementBulkRef, {
      ingredientId: bulkId,
      changeAmount: -totalBulkQty,
      newStockAfter: nextBulkStock,
      sourceType: "production",
      sourceId: null,
      note: `Repack glaze ${flavorId} curah menjadi ${cupQty} ${targetType === "cup" ? "cup" : "plastik tiktok"}`,
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
    });

    const movementCupRef = adminDb.collection("stockMovements").doc();
    tx.set(movementCupRef, {
      ingredientId: cupId,
      changeAmount: cupQty,
      newStockAfter: nextCupStock,
      sourceType: "production",
      sourceId: null,
      note: `Hasil repack dari ${totalBulkQty}g glaze curah (${conversionGrams}g per pc)`,
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function blenderCinnamon(batchCount: number, userId: string) {
  const sugarQty = batchCount * BUSINESS.CINNAMON_BATCH_SUGAR_GRAMS;
  const cinnamonQty = batchCount * BUSINESS.CINNAMON_BATCH_POWDER_GRAMS;
  const bulkSugarProduced = sugarQty + cinnamonQty;

  const sugarRef = adminDb.collection("ingredients").doc("gula-pasir");
  const cinnamonRef = adminDb.collection("ingredients").doc("bubuk-kayu-manis");
  const bulkSugarRef = adminDb.collection("ingredients").doc("gula-cinnamon-bulk");

  await adminDb.runTransaction(async (tx) => {
    const sugarSnap = await tx.get(sugarRef);
    const cinnamonSnap = await tx.get(cinnamonRef);
    const bulkSugarSnap = await tx.get(bulkSugarRef);

    if (!sugarSnap.exists) throw new Error("Gula Pasir tidak ditemukan");
    if (!cinnamonSnap.exists) throw new Error("Kayu Manis Bubuk tidak ditemukan");
    if (!bulkSugarSnap.exists) throw new Error("Gula Cinnamon Curah tidak ditemukan");

    const sugarStock = sugarSnap.data()?.currentStock ?? 0;
    const cinnamonStock = cinnamonSnap.data()?.currentStock ?? 0;
    const bulkSugarStock = bulkSugarSnap.data()?.currentStock ?? 0;

    if (sugarStock < sugarQty) {
      throw new Error(`Stok Gula Pasir tidak mencukupi (tersedia: ${sugarStock}g, dibutuhkan: ${sugarQty}g)`);
    }
    if (cinnamonStock < cinnamonQty) {
      throw new Error(`Stok Kayu Manis Bubuk tidak mencukupi (tersedia: ${cinnamonStock}g, dibutuhkan: ${cinnamonQty}g)`);
    }

    const nextSugarStock = sugarStock - sugarQty;
    const nextCinnamonStock = cinnamonStock - cinnamonQty;
    const nextBulkSugarStock = bulkSugarStock + bulkSugarProduced;

    tx.update(sugarRef, { currentStock: nextSugarStock });
    tx.update(cinnamonRef, { currentStock: nextCinnamonStock });
    tx.update(bulkSugarRef, { currentStock: nextBulkSugarStock });

    const mSugar = adminDb.collection("stockMovements").doc();
    tx.set(mSugar, {
      ingredientId: "gula-pasir",
      changeAmount: -sugarQty,
      newStockAfter: nextSugarStock,
      sourceType: "production",
      sourceId: null,
      note: `Blender Gula Cinnamon (${batchCount} batch, menghasilkan ${bulkSugarProduced}g curah)`,
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
    });

    const mCinnamon = adminDb.collection("stockMovements").doc();
    tx.set(mCinnamon, {
      ingredientId: "bubuk-kayu-manis",
      changeAmount: -cinnamonQty,
      newStockAfter: nextCinnamonStock,
      sourceType: "production",
      sourceId: null,
      note: `Blender Gula Cinnamon (${batchCount} batch, menghasilkan ${bulkSugarProduced}g curah)`,
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
    });

    const mBulk = adminDb.collection("stockMovements").doc();
    tx.set(mBulk, {
      ingredientId: "gula-cinnamon-bulk",
      changeAmount: bulkSugarProduced,
      newStockAfter: nextBulkSugarStock,
      sourceType: "production",
      sourceId: null,
      note: `Hasil blender ${sugarQty}g gula pasir & ${cinnamonQty}g kayu manis`,
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function repackCinnamonClip(producedQty: number, userId: string) {
  const bulkQtyNeeded = producedQty * BUSINESS.CINNAMON_CLIP_GRAMS;

  const bulkSugarRef = adminDb.collection("ingredients").doc("gula-cinnamon-bulk");
  const finalSugarRef = adminDb.collection("ingredients").doc("gula-halus-cinnamon");

  await adminDb.runTransaction(async (tx) => {
    const bulkSugarSnap = await tx.get(bulkSugarRef);
    const finalSugarSnap = await tx.get(finalSugarRef);

    if (!bulkSugarSnap.exists) throw new Error("Gula Cinnamon Curah tidak ditemukan");
    if (!finalSugarSnap.exists) throw new Error("Gula Halus Cinnamon tidak ditemukan");

    const bulkSugarStock = bulkSugarSnap.data()?.currentStock ?? 0;
    const finalSugarStock = finalSugarSnap.data()?.currentStock ?? 0;

    if (bulkSugarStock < bulkQtyNeeded) {
      throw new Error(`Stok gula curah di toples tidak mencukupi (tersedia: ${bulkSugarStock}g, dibutuhkan: ${bulkQtyNeeded}g). Silakan lakukan blender terlebih dahulu.`);
    }

    const nextBulkSugarStock = bulkSugarStock - bulkQtyNeeded;
    const nextFinalSugarStock = finalSugarStock + producedQty;

    tx.update(bulkSugarRef, { currentStock: nextBulkSugarStock });
    tx.update(finalSugarRef, { currentStock: nextFinalSugarStock });

    const mBulk = adminDb.collection("stockMovements").doc();
    tx.set(mBulk, {
      ingredientId: "gula-cinnamon-bulk",
      changeAmount: -bulkQtyNeeded,
      newStockAfter: nextBulkSugarStock,
      sourceType: "production",
      sourceId: null,
      note: `Repack gula cinnamon curah ke clip (${producedQty} pcs)`,
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
    });

    const mFinal = adminDb.collection("stockMovements").doc();
    tx.set(mFinal, {
      ingredientId: "gula-halus-cinnamon",
      changeAmount: producedQty,
      newStockAfter: nextFinalSugarStock,
      sourceType: "production",
      sourceId: null,
      note: `Kemas clip gula cinnamon dari curah (${bulkQtyNeeded}g)`,
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function clearCinnamonBulk(userId: string) {
  const bulkSugarRef = adminDb.collection("ingredients").doc("gula-cinnamon-bulk");

  await adminDb.runTransaction(async (tx) => {
    const bulkSugarSnap = await tx.get(bulkSugarRef);
    if (!bulkSugarSnap.exists) throw new Error("Gula Cinnamon Curah tidak ditemukan");

    const bulkSugarStock = bulkSugarSnap.data()?.currentStock ?? 0;

    if (bulkSugarStock > 0) {
      tx.update(bulkSugarRef, { currentStock: 0 });

      const mBulk = adminDb.collection("stockMovements").doc();
      tx.set(mBulk, {
        ingredientId: "gula-cinnamon-bulk",
        changeAmount: -bulkSugarStock,
        newStockAfter: 0,
        sourceType: "production",
        sourceId: null,
        note: "Penyelarasan stok: toples dikosongkan secara manual oleh crew",
        createdBy: userId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  });
}

export async function repackRegToFull(variantId: string, regularPacksToUnpack: number, userId: string) {
  const regStockId = `churros-frozen-regular_${variantId}`;
  const fullStockId = `churros-frozen-full_${variantId}`;
  
  const regStockRef = adminDb.collection("productStocks").doc(regStockId);
  const fullStockRef = adminDb.collection("productStocks").doc(fullStockId);
  const bufferRef = adminDb.collection("prePackingBuffer").doc(`${variantId}_standard`);
  
  const plastikFullRef = adminDb.collection("ingredients").doc("plastik-full");
  const stikerRef = adminDb.collection("ingredients").doc("stiker-label");

  let producedFullPacks = 0;
  let newBufferPcs = 0;

  await adminDb.runTransaction(async (tx) => {
    const regSnap = await tx.get(regStockRef);
    const fullSnap = await tx.get(fullStockRef);
    const bufferSnap = await tx.get(bufferRef);
    const plastikFullSnap = await tx.get(plastikFullRef);
    const stikerSnap = await tx.get(stikerRef);

    if (!regSnap.exists) throw new Error("Stok produk Regular tidak ditemukan di database");
    
    const regStock = regSnap.data()?.currentStock ?? 0;
    const fullStock = fullSnap.exists ? (fullSnap.data()?.currentStock ?? 0) : 0;
    const currentBufferPcs = bufferSnap.exists ? (bufferSnap.data()?.currentBufferPcs ?? 0) : 0;

    if (regStock < regularPacksToUnpack) {
      throw new Error(`Stok Regular ${variantId} tidak mencukupi (tersedia: ${regStock} pack, diminta bongkar: ${regularPacksToUnpack} pack)`);
    }

    const totalPcs = (regularPacksToUnpack * 12) + currentBufferPcs;
    producedFullPacks = Math.floor(totalPcs / 16);
    newBufferPcs = totalPcs % 16;

    const plastikFullStock = plastikFullSnap.exists ? (plastikFullSnap.data()?.currentStock ?? 0) : 0;
    const stikerStock = stikerSnap.exists ? (stikerSnap.data()?.currentStock ?? 0) : 0;

    if (plastikFullStock < producedFullPacks) throw new Error(`Stok kemasan plastik full kurang (tersedia: ${plastikFullStock} pcs, dibutuhkan: ${producedFullPacks} pcs)`);
    if (stikerStock < producedFullPacks) throw new Error(`Stok stiker label kurang (tersedia: ${stikerStock} lembar, dibutuhkan: ${producedFullPacks} lembar)`);

    const nextRegStock = regStock - regularPacksToUnpack;
    const nextFullStock = fullStock + producedFullPacks;

    tx.update(regStockRef, { currentStock: nextRegStock });
    tx.set(fullStockRef, {
      productId: "churros-frozen-full",
      variantId,
      currentStock: nextFullStock,
    }, { merge: true });

    const mReg = adminDb.collection("stockMovements").doc();
    tx.set(mReg, {
      ingredientId: `product:churros-frozen-regular_${variantId}`,
      changeAmount: -regularPacksToUnpack,
      newStockAfter: nextRegStock,
      sourceType: "production",
      sourceId: null,
      note: `Bongkar ${regularPacksToUnpack} Regular untuk repack ke Full`,
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (producedFullPacks > 0) {
      const mFull = adminDb.collection("stockMovements").doc();
      tx.set(mFull, {
        ingredientId: `product:churros-frozen-full_${variantId}`,
        changeAmount: producedFullPacks,
        newStockAfter: nextFullStock,
        sourceType: "production",
        sourceId: null,
        note: `Hasil repack dari ${regularPacksToUnpack} Regular`,
        createdBy: userId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    tx.set(bufferRef, {
      variantId,
      currentBufferPcs: newBufferPcs,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const nextPlastikStock = plastikFullStock - producedFullPacks;
    const nextStikerStock = stikerStock - producedFullPacks;

    tx.update(plastikFullRef, { currentStock: nextPlastikStock });
    tx.update(stikerRef, { currentStock: nextStikerStock });

    if (producedFullPacks > 0) {
      const mPlastik = adminDb.collection("stockMovements").doc();
      tx.set(mPlastik, {
        ingredientId: "plastik-full",
        changeAmount: -producedFullPacks,
        newStockAfter: nextPlastikStock,
        sourceType: "production",
        sourceId: null,
        note: `Repack regular ke full variant ${variantId} (${regularPacksToUnpack} regular dibongkar)`,
        createdBy: userId,
        createdAt: FieldValue.serverTimestamp(),
      });

      const mStiker = adminDb.collection("stockMovements").doc();
      tx.set(mStiker, {
        ingredientId: "stiker-label",
        changeAmount: -producedFullPacks,
        newStockAfter: nextStikerStock,
        sourceType: "production",
        sourceId: null,
        note: `Repack regular ke full variant ${variantId} (${regularPacksToUnpack} regular dibongkar)`,
        createdBy: userId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  });

  return { producedFullPacks, leftoverBufferPcs: newBufferPcs };
}

export async function packOrder(orderId: string, glazeSelections: Record<string, number>, userId: string) {
  const orderRef = adminDb.collection("orders").doc(orderId);
  const itemsSnap = await orderRef.collection("items").get();

  if (itemsSnap.empty) throw new Error("Order tidak memiliki item");

  await adminDb.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new Error("Order tidak ditemukan");
    
    const orderData = orderSnap.data()!;
    if (orderData.status === "selesai") throw new Error("Order sudah diselesaikan sebelumnya");
    if (orderData.status === "void") throw new Error("Order sudah di-void");

    const orderNumber = orderData.orderNumber ?? orderId;

    const productStockSnaps = new Map<string, { ref: FirebaseFirestore.DocumentReference, snap: FirebaseFirestore.DocumentSnapshot }>();
    for (const itemDoc of itemsSnap.docs) {
      const item = itemDoc.data();
      const isRainbow = item.productId === "churros-rainbow" || item.variantId === "rainbow";
      if (!isRainbow) {
        const stockId = `${item.productId}_${item.variantId}`;
        const stockRef = adminDb.collection("productStocks").doc(stockId);
        const snap = await tx.get(stockRef);
        productStockSnaps.set(stockId, { ref: stockRef, snap });
      }
    }

    const glazeSnaps = new Map<string, { ref: FirebaseFirestore.DocumentReference, snap: FirebaseFirestore.DocumentSnapshot }>();
    for (const key of Object.keys(glazeSelections)) {
      const qty = glazeSelections[key];
      if (qty > 0) {
        const ingRef = adminDb.collection("ingredients").doc(key);
        const snap = await tx.get(ingRef);
        glazeSnaps.set(key, { ref: ingRef, snap });
      }
    }

    let totalFrozenPacks = 0;
    let totalRegularPacks = 0;
    let totalFullPacks = 0;
    let totalTikTokPacks = 0;

    for (const itemDoc of itemsSnap.docs) {
      const item = itemDoc.data();
      if (item.productId === "churros-frozen-regular") {
        totalFrozenPacks += item.qty;
        totalRegularPacks += item.qty;
      } else if (item.productId === "churros-frozen-full") {
        totalFrozenPacks += item.qty;
        totalFullPacks += item.qty;
      } else if (item.productId === "churros-frozen-tiktok") {
        totalFrozenPacks += item.qty;
        totalTikTokPacks += item.qty;
      }
    }

    let cinnamonSnap = null;
    const cinnamonRef = adminDb.collection("ingredients").doc("gula-halus-cinnamon");
    if (totalFrozenPacks > 0) cinnamonSnap = await tx.get(cinnamonRef);

    let plastikRegSnap = null;
    let plastikFullSnap = null;
    let stikerSnap = null;

    const plastikRegRef = adminDb.collection("ingredients").doc("plastik-regular");
    const plastikFullRef = adminDb.collection("ingredients").doc("plastik-full");
    const stikerRef = adminDb.collection("ingredients").doc("stiker-label");

    if (totalRegularPacks > 0 || totalTikTokPacks > 0) plastikRegSnap = await tx.get(plastikRegRef);
    if (totalFullPacks > 0) plastikFullSnap = await tx.get(plastikFullRef);
    const totalStikers = totalRegularPacks + totalFullPacks + totalTikTokPacks;
    if (totalStikers > 0) stikerSnap = await tx.get(stikerRef);

    for (const itemDoc of itemsSnap.docs) {
      const item = itemDoc.data();
      const isRainbow = item.productId === "churros-rainbow" || item.variantId === "rainbow";
      if (!isRainbow) {
        const stockId = `${item.productId}_${item.variantId}`;
        const target = productStockSnaps.get(stockId);
        const currStock = target?.snap?.exists ? (target.snap.data()?.currentStock ?? 0) : 0;
        const newStock = currStock - item.qty;
        if (target) {
          tx.set(target.ref, {
            productId: item.productId,
            variantId: item.variantId,
            currentStock: newStock,
          }, { merge: true });

          const movementRef = adminDb.collection("stockMovements").doc();
          tx.set(movementRef, {
            ingredientId: `product:${stockId}`,
            changeAmount: -item.qty,
            newStockAfter: newStock,
            sourceType: "sale",
            sourceId: orderId,
            note: `Pengepakan pesanan order ${orderNumber}`,
            createdBy: userId,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      }
    }

    for (const [key, qty] of Object.entries(glazeSelections)) {
      if (qty > 0) {
        const target = glazeSnaps.get(key);
        if (!target || !target.snap.exists) throw new Error(`Bahan glaze "${key}" tidak ditemukan`);
        
        const currStock = target.snap.data()?.currentStock ?? 0;
        const nextStock = currStock - qty;
        tx.update(target.ref, { currentStock: nextStock });

        const movementRef = adminDb.collection("stockMovements").doc();
        tx.set(movementRef, {
          ingredientId: key,
          changeAmount: -qty,
          newStockAfter: nextStock,
          sourceType: "production",
          sourceId: orderId,
          note: `Packing glaze cup/plastic untuk order ${orderNumber}`,
          createdBy: userId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }

    if (totalFrozenPacks > 0 && cinnamonSnap && cinnamonSnap.exists) {
      const qtyNeeded = totalFrozenPacks;
      const currStock = cinnamonSnap.data()?.currentStock ?? 0;
      const nextStock = currStock - qtyNeeded;
      tx.update(cinnamonRef, { currentStock: nextStock });

      const movementRef = adminDb.collection("stockMovements").doc();
      tx.set(movementRef, {
        ingredientId: "gula-halus-cinnamon",
        changeAmount: -qtyNeeded,
        newStockAfter: nextStock,
        sourceType: "production",
        sourceId: orderId,
        note: `Packing gula cinnamon untuk order ${orderNumber}`,
        createdBy: userId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    const totalPlastikRegNeeded = totalRegularPacks + totalTikTokPacks;
    if (totalPlastikRegNeeded > 0 && plastikRegSnap && plastikRegSnap.exists) {
      const currStock = plastikRegSnap.data()?.currentStock ?? 0;
      const nextStock = currStock - totalPlastikRegNeeded;
      tx.update(plastikRegRef, { currentStock: nextStock });

      const movementRef = adminDb.collection("stockMovements").doc();
      tx.set(movementRef, {
        ingredientId: "plastik-regular",
        changeAmount: -totalPlastikRegNeeded,
        newStockAfter: nextStock,
        sourceType: "production",
        sourceId: orderId,
        note: `Kemasan Regular & TikTok order ${orderNumber}`,
        createdBy: userId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    if (totalFullPacks > 0 && plastikFullSnap && plastikFullSnap.exists) {
      const currStock = plastikFullSnap.data()?.currentStock ?? 0;
      const nextStock = currStock - totalFullPacks;
      tx.update(plastikFullRef, { currentStock: nextStock });

      const movementRef = adminDb.collection("stockMovements").doc();
      tx.set(movementRef, {
        ingredientId: "plastik-full",
        changeAmount: -totalFullPacks,
        newStockAfter: nextStock,
        sourceType: "production",
        sourceId: orderId,
        note: `Kemasan Full order ${orderNumber}`,
        createdBy: userId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    if (totalStikers > 0 && stikerSnap && stikerSnap.exists) {
      const currStock = stikerSnap.data()?.currentStock ?? 0;
      const nextStock = currStock - totalStikers;
      tx.update(stikerRef, { currentStock: nextStock });

      const movementRef = adminDb.collection("stockMovements").doc();
      tx.set(movementRef, {
        ingredientId: "stiker-label",
        changeAmount: -totalStikers,
        newStockAfter: nextStock,
        sourceType: "production",
        sourceId: orderId,
        note: `Stiker label order ${orderNumber}`,
        createdBy: userId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    tx.update(orderRef, {
      status: "selesai",
      completedAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function manualUsage(updates: { id: string; qtyUsed: number }[], note: string | undefined, userId: string) {
  if (!updates || !updates.length) throw new Error("Updates tidak boleh kosong");

  await adminDb.runTransaction(async (tx) => {
    const snaps = new Map<string, { ref: FirebaseFirestore.DocumentReference, snap: FirebaseFirestore.DocumentSnapshot }>();
    for (const item of updates) {
      const ref = adminDb.collection("ingredients").doc(item.id);
      const snap = await tx.get(ref);
      snaps.set(item.id, { ref, snap });
    }

    for (const item of updates) {
      const target = snaps.get(item.id);
      if (!target || !target.snap.exists) throw new Error(`Bahan baku "${item.id}" tidak ditemukan`);
      
      const currStock = target.snap.data()?.currentStock ?? 0;
      const nextStock = currStock - item.qtyUsed;
      tx.update(target.ref, { currentStock: nextStock });

      const movementRef = adminDb.collection("stockMovements").doc();
      tx.set(movementRef, {
        ingredientId: item.id,
        changeAmount: -item.qtyUsed,
        newStockAfter: nextStock,
        sourceType: "production",
        sourceId: null,
        note: note || "Pemakaian packing manual",
        createdBy: userId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  });
}
