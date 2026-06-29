import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const variantId = searchParams.get("variantId");

  if (action === "get_repack_data") {
    if (!variantId) {
      return NextResponse.json({ error: "variantId wajib diisi" }, { status: 400 });
    }

    try {
      const regStockRef = adminDb.collection("productStocks").doc(`churros-frozen-regular_${variantId}`);
      const bufferRef = adminDb.collection("prePackingBuffer").doc(`${variantId}_standard`);

      const [regSnap, bufferSnap] = await Promise.all([
        regStockRef.get(),
        bufferRef.get(),
      ]);

      const regularStock = regSnap.exists ? (regSnap.data()?.currentStock ?? 0) : 0;
      const bufferPcs = bufferSnap.exists ? (bufferSnap.data()?.currentBufferPcs ?? 0) : 0;

      return NextResponse.json({ regularStock, bufferPcs });
    } catch (err) {
      console.error("GET /api/packing repack data error:", err);
      return NextResponse.json({ error: "Gagal mengambil data repack" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Action tidak dikenali" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  try {
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: "Action wajib diisi" }, { status: 400 });
    }

    if (action === "repack_glaze") {
      const { flavorId, targetType, cupQty } = body as {
        flavorId: string;
        targetType: "cup" | "tiktok";
        cupQty: number;
      };

      if (!flavorId || !targetType || !cupQty || cupQty <= 0) {
        return NextResponse.json({ error: "Parameter repack_glaze tidak valid" }, { status: 400 });
      }

      const bulkId = `glaze-${flavorId}-bulk`;
      // Target is standard cup or TikTok vacuum plastic
      const cupId = targetType === "cup" ? `saus-${flavorId}` : `saus-${flavorId}-tiktok`;
      const conversionGrams = targetType === "cup" ? 13 : 15;
      const totalBulkQty = cupQty * conversionGrams;

      const bulkRef = adminDb.collection("ingredients").doc(bulkId);
      const cupRef = adminDb.collection("ingredients").doc(cupId);

      await adminDb.runTransaction(async (tx) => {
        // 1. READS
        const bulkSnap = await tx.get(bulkRef);
        const cupSnap = await tx.get(cupRef);

        if (!bulkSnap.exists) {
          throw new Error(`Bahan bulk "${bulkId}" tidak ditemukan`);
        }
        if (!cupSnap.exists) {
          throw new Error(`Bahan target "${cupId}" tidak ditemukan`);
        }

        const bulkStock = bulkSnap.data()?.currentStock ?? 0;
        const cupStock = cupSnap.data()?.currentStock ?? 0;

        if (bulkStock < totalBulkQty) {
          throw new Error(`Stok curah ${bulkSnap.data()?.name} tidak mencukupi (tersedia: ${bulkStock}g, dibutuhkan: ${totalBulkQty}g)`);
        }

        const nextBulkStock = bulkStock - totalBulkQty;
        const nextCupStock = cupStock + cupQty;

        // 2. WRITES
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
          createdBy: user.uid,
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
          createdBy: user.uid,
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      return NextResponse.json({ success: true });
    }

    if (action === "blender_cinnamon") {
      const { batchCount } = body as {
        batchCount: number;
      };

      if (!batchCount || batchCount <= 0) {
        return NextResponse.json({ error: "Jumlah batch blender tidak valid" }, { status: 400 });
      }

      // Formula: 1 batch = 1500g Gula Pasir + 40g Kayu Manis Bubuk
      const sugarQty = batchCount * 1500;
      const cinnamonQty = batchCount * 40;
      const bulkSugarProduced = batchCount * 1540;

      const sugarRef = adminDb.collection("ingredients").doc("gula-pasir");
      const cinnamonRef = adminDb.collection("ingredients").doc("bubuk-kayu-manis");
      const bulkSugarRef = adminDb.collection("ingredients").doc("gula-cinnamon-bulk");

      await adminDb.runTransaction(async (tx) => {
        // 1. READS
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

        // 2. WRITES
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
          createdBy: user.uid,
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
          createdBy: user.uid,
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
          createdBy: user.uid,
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      return NextResponse.json({ success: true });
    }

    if (action === "repack_cinnamon_clip") {
      const { producedQty } = body as {
        producedQty: number;
      };

      if (!producedQty || producedQty <= 0) {
        return NextResponse.json({ error: "Jumlah kemasan clip tidak valid" }, { status: 400 });
      }

      // Formula: 1 clip = 5g Gula Cinnamon Curah
      const bulkQtyNeeded = producedQty * 5;

      const bulkSugarRef = adminDb.collection("ingredients").doc("gula-cinnamon-bulk");
      const finalSugarRef = adminDb.collection("ingredients").doc("gula-halus-cinnamon");

      await adminDb.runTransaction(async (tx) => {
        // 1. READS
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

        // 2. WRITES
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
          createdBy: user.uid,
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
          createdBy: user.uid,
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      return NextResponse.json({ success: true });
    }

    if (action === "clear_cinnamon_bulk") {
      const bulkSugarRef = adminDb.collection("ingredients").doc("gula-cinnamon-bulk");

      await adminDb.runTransaction(async (tx) => {
        // 1. READS
        const bulkSugarSnap = await tx.get(bulkSugarRef);
        if (!bulkSugarSnap.exists) throw new Error("Gula Cinnamon Curah tidak ditemukan");

        const bulkSugarStock = bulkSugarSnap.data()?.currentStock ?? 0;

        if (bulkSugarStock > 0) {
          // 2. WRITES
          tx.update(bulkSugarRef, { currentStock: 0 });

          const mBulk = adminDb.collection("stockMovements").doc();
          tx.set(mBulk, {
            ingredientId: "gula-cinnamon-bulk",
            changeAmount: -bulkSugarStock,
            newStockAfter: 0,
            sourceType: "production",
            sourceId: null,
            note: "Penyelarasan stok: toples dikosongkan secara manual oleh crew",
            createdBy: user.uid,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      });

      return NextResponse.json({ success: true });
    }

    if (action === "repack_reg_to_full") {
      const { variantId, regularPacksToUnpack } = body as {
        variantId: string;
        regularPacksToUnpack: number;
      };

      if (!variantId || !regularPacksToUnpack || regularPacksToUnpack <= 0) {
        return NextResponse.json({ error: "Parameter repack_reg_to_full tidak valid" }, { status: 400 });
      }

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
        // 1. READS
        const regSnap = await tx.get(regStockRef);
        const fullSnap = await tx.get(fullStockRef);
        const bufferSnap = await tx.get(bufferRef);
        const plastikFullSnap = await tx.get(plastikFullRef);
        const stikerSnap = await tx.get(stikerRef);

        if (!regSnap.exists) {
          throw new Error("Stok produk Regular tidak ditemukan di database");
        }
        
        const regStock = regSnap.data()?.currentStock ?? 0;
        const fullStock = fullSnap.exists ? (fullSnap.data()?.currentStock ?? 0) : 0;
        const currentBufferPcs = bufferSnap.exists ? (bufferSnap.data()?.currentBufferPcs ?? 0) : 0;

        if (regStock < regularPacksToUnpack) {
          throw new Error(`Stok Regular ${variantId} tidak mencukupi (tersedia: ${regStock} pack, diminta bongkar: ${regularPacksToUnpack} pack)`);
        }

        // Calculations
        const totalPcs = (regularPacksToUnpack * 12) + currentBufferPcs;
        producedFullPacks = Math.floor(totalPcs / 16);
        newBufferPcs = totalPcs % 16;

        // Check packaging stock
        const plastikFullStock = plastikFullSnap.exists ? (plastikFullSnap.data()?.currentStock ?? 0) : 0;
        const stikerStock = stikerSnap.exists ? (stikerSnap.data()?.currentStock ?? 0) : 0;

        if (plastikFullStock < producedFullPacks) {
          throw new Error(`Stok kemasan plastik full kurang (tersedia: ${plastikFullStock} pcs, dibutuhkan: ${producedFullPacks} pcs)`);
        }
        if (stikerStock < producedFullPacks) {
          throw new Error(`Stok stiker label kurang (tersedia: ${stikerStock} lembar, dibutuhkan: ${producedFullPacks} lembar)`);
        }

        const nextRegStock = regStock - regularPacksToUnpack;
        const nextFullStock = fullStock + producedFullPacks;

        // 2. WRITES
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
          createdBy: user.uid,
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
            createdBy: user.uid,
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        tx.set(bufferRef, {
          variantId,
          currentBufferPcs: newBufferPcs,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        // Deduct packaging
        const nextPlastikStock = plastikFullStock - producedFullPacks;
        const nextStikerStock = stikerStock - producedFullPacks;

        tx.update(plastikFullRef, { currentStock: nextPlastikStock });
        tx.update(stikerRef, { currentStock: nextStikerStock });

        // Stock movements for packaging
        if (producedFullPacks > 0) {
          const mPlastik = adminDb.collection("stockMovements").doc();
          tx.set(mPlastik, {
            ingredientId: "plastik-full",
            changeAmount: -producedFullPacks,
            newStockAfter: nextPlastikStock,
            sourceType: "production",
            sourceId: null,
            note: `Repack regular ke full variant ${variantId} (${regularPacksToUnpack} regular dibongkar)`,
            createdBy: user.uid,
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
            createdBy: user.uid,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      });

      return NextResponse.json({ success: true, producedFullPacks, leftoverBufferPcs: newBufferPcs });
    }

    if (action === "pack_order") {
      const { orderId, glazeSelections } = body as {
        orderId: string;
        glazeSelections: Record<string, number>;
      };

      if (!orderId) {
        return NextResponse.json({ error: "OrderId wajib diisi" }, { status: 400 });
      }

      const orderRef = adminDb.collection("orders").doc(orderId);
      const itemsSnap = await orderRef.collection("items").get();

      if (itemsSnap.empty) {
        return NextResponse.json({ error: "Order tidak memiliki item" }, { status: 400 });
      }

      await adminDb.runTransaction(async (tx) => {
        // 1. READS
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists) {
          throw new Error("Order tidak ditemukan");
        }
        const orderData = orderSnap.data()!;
        if (orderData.status === "selesai") {
          throw new Error("Order sudah diselesaikan sebelumnya");
        }
        if (orderData.status === "void") {
          throw new Error("Order sudah di-void");
        }

        const orderNumber = orderData.orderNumber ?? orderId;

        // Fetch productStocks for all items (standard products)
        const productStockSnaps = new Map<string, any>();
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

        // Fetch ingredients for glazeSelections
        const glazeSnaps = new Map<string, any>();
        for (const key of Object.keys(glazeSelections)) {
          const qty = glazeSelections[key];
          if (qty > 0) {
            const ingRef = adminDb.collection("ingredients").doc(key);
            const snap = await tx.get(ingRef);
            glazeSnaps.set(key, { ref: ingRef, snap });
          }
        }

        // Calculate frozen packs to deduct cinnamon sugar & packaging
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

        // Fetch cinnamon sugar if totalFrozenPacks > 0
        let cinnamonSnap = null;
        const cinnamonRef = adminDb.collection("ingredients").doc("gula-halus-cinnamon");
        if (totalFrozenPacks > 0) {
          cinnamonSnap = await tx.get(cinnamonRef);
        }

        // Fetch packaging snaps
        let plastikRegSnap = null;
        let plastikFullSnap = null;
        let stikerSnap = null;

        const plastikRegRef = adminDb.collection("ingredients").doc("plastik-regular");
        const plastikFullRef = adminDb.collection("ingredients").doc("plastik-full");
        const stikerRef = adminDb.collection("ingredients").doc("stiker-label");

        if (totalRegularPacks > 0 || totalTikTokPacks > 0) {
          plastikRegSnap = await tx.get(plastikRegRef);
        }
        if (totalFullPacks > 0) {
          plastikFullSnap = await tx.get(plastikFullRef);
        }
        const totalStikers = totalRegularPacks + totalFullPacks + totalTikTokPacks;
        if (totalStikers > 0) {
          stikerSnap = await tx.get(stikerRef);
        }

        // 2. WRITES

        // Deduct product stocks
        for (const itemDoc of itemsSnap.docs) {
          const item = itemDoc.data();
          const isRainbow = item.productId === "churros-rainbow" || item.variantId === "rainbow";
          if (!isRainbow) {
            const stockId = `${item.productId}_${item.variantId}`;
            const target = productStockSnaps.get(stockId);
            const currStock = target?.snap?.exists ? (target.snap.data()?.currentStock ?? 0) : 0;
            const newStock = currStock - item.qty;
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
              createdBy: user.uid,
              createdAt: FieldValue.serverTimestamp(),
            });
          }
        }

        // Deduct glaze selections
        for (const [key, qty] of Object.entries(glazeSelections)) {
          if (qty > 0) {
            const target = glazeSnaps.get(key);
            if (!target || !target.snap.exists) {
              throw new Error(`Bahan glaze "${key}" tidak ditemukan`);
            }
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
              createdBy: user.uid,
              createdAt: FieldValue.serverTimestamp(),
            });
          }
        }

        // Deduct cinnamon sugar (1 pc per pack)
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
            createdBy: user.uid,
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        // Combine plastik-regular updates
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
            createdBy: user.uid,
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
            createdBy: user.uid,
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
            createdBy: user.uid,
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        // Update order status
        tx.update(orderRef, {
          status: "selesai",
          completedAt: FieldValue.serverTimestamp(),
        });
      });

      return NextResponse.json({ success: true });
    }

    if (action === "manual_usage") {
      const { updates, note } = body as {
        updates: { id: string; qtyUsed: number }[];
        note?: string;
      };

      if (!updates || !updates.length) {
        return NextResponse.json({ error: "Updates tidak boleh kosong" }, { status: 400 });
      }

      await adminDb.runTransaction(async (tx) => {
        // 1. READS
        const snaps = new Map<string, any>();
        for (const item of updates) {
          const ref = adminDb.collection("ingredients").doc(item.id);
          const snap = await tx.get(ref);
          snaps.set(item.id, { ref, snap });
        }

        // 2. WRITES
        for (const item of updates) {
          const target = snaps.get(item.id);
          if (!target || !target.snap.exists) {
            throw new Error(`Bahan baku "${item.id}" tidak ditemukan`);
          }
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
            createdBy: user.uid,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Action tidak dikenali" }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/packing error:", err);
    return NextResponse.json({ error: err.message || "Gagal memproses packing" }, { status: 500 });
  }
}

