import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Development-only endpoint untuk seed data awal
 * POST /api/seed  dengan header: Authorization: Bearer anchurpos-seed-2025
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const seedKey = process.env.SEED_SECRET_KEY ?? "anchurpos-seed-2025";
  if (!authHeader.includes(seedKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = adminDb;
    const results: string[] = [];

    // ── Variants ────────────────────────────────────────────────────────────
    const variants = [
      { id: "original", name: "Original", sortOrder: 1, currentStock: 25, minStock: 10 },
      { id: "taro", name: "Taro", sortOrder: 2, currentStock: 18, minStock: 10 },
      { id: "matcha", name: "Matcha", sortOrder: 3, currentStock: 5, minStock: 10 },
      { id: "red-velvet", name: "Red Velvet", sortOrder: 4, currentStock: 12, minStock: 10 },
      { id: "charcoal", name: "Charcoal", sortOrder: 5, currentStock: 8, minStock: 10 },
    ];
    for (const v of variants) {
      await db.doc(`variants/${v.id}`).set({
        name: v.name, isProductionVariant: true,
        sortOrder: v.sortOrder, currentStock: v.currentStock, minStock: v.minStock,
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    results.push(`${variants.length} variants seeded`);

    // ── Products ────────────────────────────────────────────────────────────
    const products = [
      { id: "lava-cake", name: "Lava Cake", code: "LVC", description: "Lava cake premium", packPerBatch: 6, isActive: true,
        priceTiers: [{ id: "t1", minQty: 1, maxQty: 5, price: 35000 }, { id: "t2", minQty: 6, maxQty: 12, price: 32000 }, { id: "t3", minQty: 13, maxQty: null, price: 29000 }] },
      { id: "brownies", name: "Brownies", code: "BRW", description: "Brownies fudgy", packPerBatch: 8, isActive: true,
        priceTiers: [{ id: "t1", minQty: 1, maxQty: 5, price: 28000 }, { id: "t2", minQty: 6, maxQty: null, price: 25000 }] },
      { id: "churros", name: "Churros", code: "CHR", description: "Churros renyah", packPerBatch: 10, isActive: true,
        priceTiers: [{ id: "t1", minQty: 1, maxQty: 5, price: 22000 }, { id: "t2", minQty: 6, maxQty: null, price: 19000 }] },
    ];
    for (const p of products) {
      const { priceTiers, ...fields } = p;
      await db.doc(`products/${p.id}`).set({ ...fields, createdAt: FieldValue.serverTimestamp() }, { merge: true });
      for (const tier of priceTiers) {
        await db.doc(`products/${p.id}/priceTiers/${tier.id}`).set({ ...tier }, { merge: true });
      }
    }
    results.push(`${products.length} products seeded`);

    // ── Ingredients ─────────────────────────────────────────────────────────
    const ingredients = [
      { id: "tepung-terigu", name: "Tepung Terigu", category: "bahan_baku", currentStock: 15, minStock: 5, baseUnit: "kg" },
      { id: "gula-pasir", name: "Gula Pasir", category: "bahan_baku", currentStock: 8, minStock: 3, baseUnit: "kg" },
      { id: "coklat-bubuk", name: "Coklat Bubuk", category: "bahan_baku", currentStock: 2, minStock: 3, baseUnit: "kg" },
      { id: "mentega", name: "Mentega", category: "bahan_baku", currentStock: 5, minStock: 2, baseUnit: "kg" },
      { id: "telur", name: "Telur", category: "bahan_baku", currentStock: 60, minStock: 30, baseUnit: "butir" },
      { id: "taro-paste", name: "Taro Paste", category: "bahan_baku", currentStock: 1.5, minStock: 2, baseUnit: "kg" },
      { id: "matcha-powder", name: "Matcha Powder", category: "bahan_baku", currentStock: 0.8, minStock: 1, baseUnit: "kg" },
    ];
    for (const i of ingredients) {
      await db.doc(`ingredients/${i.id}`).set({ ...i, createdAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    results.push(`${ingredients.length} ingredients seeded`);

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
