import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

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
      const { flavorId, bulkQty, cupQty } = body as {
        flavorId: string;
        bulkQty: number;
        cupQty: number;
      };

      if (!flavorId || !bulkQty || bulkQty <= 0 || !cupQty || cupQty <= 0) {
        return NextResponse.json({ error: "Parameter repack_glaze tidak valid" }, { status: 400 });
      }

      const bulkId = `glaze-${flavorId}-bulk`;
      const cupId = `saus-${flavorId}`;

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
          throw new Error(`Bahan cup "${cupId}" tidak ditemukan`);
        }

        const bulkStock = bulkSnap.data()?.currentStock ?? 0;
        const cupStock = cupSnap.data()?.currentStock ?? 0;

        if (bulkStock < bulkQty) {
          throw new Error(`Stok curah ${bulkSnap.data()?.name} tidak mencukupi (tersedia: ${bulkStock}g)`);
        }

        const nextBulkStock = bulkStock - bulkQty;
        const nextCupStock = cupStock + cupQty;

        // 2. WRITES
        tx.update(bulkRef, { currentStock: nextBulkStock });
        tx.update(cupRef, { currentStock: nextCupStock });

        const movementBulkRef = adminDb.collection("stockMovements").doc();
        tx.set(movementBulkRef, {
          ingredientId: bulkId,
          changeAmount: -bulkQty,
          newStockAfter: nextBulkStock,
          sourceType: "production",
          sourceId: null,
          note: `Repack glaze ${flavorId} curah menjadi ${cupQty} cup`,
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
          note: `Hasil repack dari ${bulkQty}g glaze curah`,
          createdBy: user.uid,
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      return NextResponse.json({ success: true });
    }

    if (action === "repack_cinnamon") {
      const { sugarQty, cinnamonQty, producedQty } = body as {
        sugarQty: number;
        cinnamonQty: number;
        producedQty: number;
      };

      if (!sugarQty || sugarQty <= 0 || !cinnamonQty || cinnamonQty <= 0 || !producedQty || producedQty <= 0) {
        return NextResponse.json({ error: "Parameter repack_cinnamon tidak valid" }, { status: 400 });
      }

      const sugarRef = adminDb.collection("ingredients").doc("gula-pasir");
      const cinnamonRef = adminDb.collection("ingredients").doc("bubuk-kayu-manis");
      const finalSugarRef = adminDb.collection("ingredients").doc("gula-halus-cinnamon");

      await adminDb.runTransaction(async (tx) => {
        // 1. READS
        const sugarSnap = await tx.get(sugarRef);
        const cinnamonSnap = await tx.get(cinnamonRef);
        const finalSugarSnap = await tx.get(finalSugarRef);

        if (!sugarSnap.exists) throw new Error("Gula Pasir tidak ditemukan");
        if (!cinnamonSnap.exists) throw new Error("Kayu Manis Bubuk tidak ditemukan");
        if (!finalSugarSnap.exists) throw new Error("Gula Halus Cinnamon tidak ditemukan");

        const sugarStock = sugarSnap.data()?.currentStock ?? 0;
        const cinnamonStock = cinnamonSnap.data()?.currentStock ?? 0;
        const finalSugarStock = finalSugarSnap.data()?.currentStock ?? 0;

        if (sugarStock < sugarQty) {
          throw new Error(`Stok Gula Pasir tidak mencukupi (tersedia: ${sugarStock}g)`);
        }
        if (cinnamonStock < cinnamonQty) {
          throw new Error(`Stok Kayu Manis Bubuk tidak mencukupi (tersedia: ${cinnamonStock}g)`);
        }

        const nextSugarStock = sugarStock - sugarQty;
        const nextCinnamonStock = cinnamonStock - cinnamonQty;
        const nextFinalSugarStock = finalSugarStock + producedQty;

        // 2. WRITES
        tx.update(sugarRef, { currentStock: nextSugarStock });
        tx.update(cinnamonRef, { currentStock: nextCinnamonStock });
        tx.update(finalSugarRef, { currentStock: nextFinalSugarStock });

        const mSugar = adminDb.collection("stockMovements").doc();
        tx.set(mSugar, {
          ingredientId: "gula-pasir",
          changeAmount: -sugarQty,
          newStockAfter: nextSugarStock,
          sourceType: "production",
          sourceId: null,
          note: `Blender Gula Cinnamon (${producedQty}g hasil)`,
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
          note: `Blender Gula Cinnamon (${producedQty}g hasil)`,
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
          note: `Hasil repack blend ${sugarQty}g gula & ${cinnamonQty}g kayu manis`,
          createdBy: user.uid,
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      return NextResponse.json({ success: true });
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
            tx.set(target.ref, {
              productId: item.productId,
              variantId: item.variantId,
              currentStock: currStock - item.qty,
            }, { merge: true });
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
              note: `Packing glaze cup untuk order ${orderNumber}`,
              createdBy: user.uid,
              createdAt: FieldValue.serverTimestamp(),
            });
          }
        }

        // Deduct cinnamon sugar (10g per pack)
        if (totalFrozenPacks > 0 && cinnamonSnap && cinnamonSnap.exists) {
          const qtyNeeded = totalFrozenPacks * 10;
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

        // Deduct packaging
        if (totalRegularPacks > 0 && plastikRegSnap && plastikRegSnap.exists) {
          const currStock = plastikRegSnap.data()?.currentStock ?? 0;
          const nextStock = currStock - totalRegularPacks;
          tx.update(plastikRegRef, { currentStock: nextStock });

          const movementRef = adminDb.collection("stockMovements").doc();
          tx.set(movementRef, {
            ingredientId: "plastik-regular",
            changeAmount: -totalRegularPacks,
            newStockAfter: nextStock,
            sourceType: "production",
            sourceId: orderId,
            note: `Kemasan Regular order ${orderNumber}`,
            createdBy: user.uid,
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        // TikTok also uses regular plastic or vacuum plastic, since no vacuum plastic exists, we deduct plastik-regular for TikTok too
        if (totalTikTokPacks > 0 && plastikRegSnap && plastikRegSnap.exists) {
          const currStock = plastikRegSnap.data()?.currentStock ?? 0;
          // Note: read from the latest updated value if already updated in regular packs, but inside transaction Firestore handles it sequentially if we do writes. Wait, since we are doing update in same transaction, we should calculate correct final stock.
          // Wait! If both regular and tiktok use plastik-regular, we should do a single update to plastik-regular!
          // Yes! Let's combine them into a single deduction.
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
