import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const secret = body.secret as string | undefined;

  const privateKey = process.env.FIREBASE_PRIVATE_KEY ?? "";
  const expectedSecret = privateKey.replace(/\\n/g, "").slice(0, 20);
  if (!secret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  try {
    const batch = adminDb.batch();

    // --- Variants (6 production + 1 rainbow) ---
    const variants = [
      { id: "original", name: "Original", isProductionVariant: true, sortOrder: 1 },
      { id: "charcoal", name: "Charcoal", isProductionVariant: true, sortOrder: 2 },
      { id: "red-velvet", name: "Red Velvet", isProductionVariant: true, sortOrder: 3 },
      { id: "taro", name: "Taro", isProductionVariant: true, sortOrder: 4 },
      { id: "coklat", name: "Coklat", isProductionVariant: true, sortOrder: 5 },
      { id: "greentea", name: "Greentea", isProductionVariant: true, sortOrder: 6 },
      { id: "rainbow", name: "Rainbow", isProductionVariant: false, sortOrder: 7 },
    ];

    for (const v of variants) {
      const ref = adminDb.collection("variants").doc(v.id);
      batch.set(ref, {
        name: v.name,
        isProductionVariant: v.isProductionVariant,
        sortOrder: v.sortOrder,
      });
    }

    // --- Products (3 products) ---
    const products = [
      { id: "churros-frozen-regular", code: "CFR", name: "Churros Frozen Regular", description: "Pack isi 12 pcs", packPerBatch: 16 },
      { id: "churros-frozen-full", code: "CFF", name: "Churros Frozen Full", description: "Pack isi 16 pcs", packPerBatch: 16 },
      { id: "churros-matang", code: "CM", name: "Churros Matang", description: "Churros siap makan", packPerBatch: 16 },
    ];

    for (const p of products) {
      const ref = adminDb.collection("products").doc(p.id);
      batch.set(ref, {
        code: p.code,
        name: p.name,
        description: p.description,
        packPerBatch: p.packPerBatch,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // --- Price tiers (placeholder — user should provide real prices) ---
    const defaultTiers = [
      { id: "tier-1", minQty: 1, maxQty: 10, price: 15000 },
      { id: "tier-2", minQty: 11, maxQty: 24, price: 14000 },
      { id: "tier-3", minQty: 25, maxQty: null, price: 13000 },
    ];

    for (const p of products) {
      for (const t of defaultTiers) {
        const ref = adminDb
          .collection("products")
          .doc(p.id)
          .collection("priceTiers")
          .doc(t.id);
        batch.set(ref, { minQty: t.minQty, maxQty: t.maxQty, price: t.price });
      }
    }

    // --- Ingredients (placeholder names — user should provide real list) ---
    const ingredients = [
      { id: "tepung-terigu", name: "Tepung Terigu", category: "bahan_baku", baseUnit: "gram", currentStock: 0, minStock: 5000, unitAlternatives: [{ unit: "kg", conversionToBase: 1000 }], opnameMethod: "direct", packagedConfig: null },
      { id: "gula-pasir", name: "Gula Pasir", category: "bahan_baku", baseUnit: "gram", currentStock: 0, minStock: 3000, unitAlternatives: [{ unit: "kg", conversionToBase: 1000 }], opnameMethod: "direct", packagedConfig: null },
      { id: "margarin", name: "Margarin", category: "bahan_baku", baseUnit: "gram", currentStock: 0, minStock: 2000, unitAlternatives: [{ unit: "kg", conversionToBase: 1000 }], opnameMethod: "direct", packagedConfig: null },
      { id: "telur", name: "Telur", category: "bahan_baku", baseUnit: "butir", currentStock: 0, minStock: 30, unitAlternatives: [], opnameMethod: "direct", packagedConfig: null },
      { id: "minyak-goreng", name: "Minyak Goreng", category: "bahan_baku", baseUnit: "ml", currentStock: 0, minStock: 5000, unitAlternatives: [{ unit: "liter", conversionToBase: 1000 }], opnameMethod: "direct", packagedConfig: null },
      { id: "perasa-charcoal", name: "Perasa Charcoal", category: "bahan_baku", baseUnit: "ml", currentStock: 0, minStock: 300, unitAlternatives: [], opnameMethod: "packaged", packagedConfig: { unitPerPackage: 300, packageLabel: "botol", fullnessOptions: [{ label: "Penuh", ratio: 1.0 }, { label: "Setengah", ratio: 0.5 }, { label: "Hampir Habis", ratio: 0.15 }, { label: "Kosong", ratio: 0 }] } },
      { id: "plastik-pack", name: "Plastik Pack", category: "packaging", baseUnit: "pcs", currentStock: 0, minStock: 100, unitAlternatives: [], opnameMethod: "direct", packagedConfig: null },
      { id: "stiker-label", name: "Stiker Label", category: "packaging", baseUnit: "lembar", currentStock: 0, minStock: 100, unitAlternatives: [], opnameMethod: "direct", packagedConfig: null },
    ];

    for (const ing of ingredients) {
      const ref = adminDb.collection("ingredients").doc(ing.id);
      batch.set(ref, {
        name: ing.name,
        category: ing.category,
        baseUnit: ing.baseUnit,
        currentStock: ing.currentStock,
        minStock: ing.minStock,
        unitAlternatives: ing.unitAlternatives,
        opnameMethod: ing.opnameMethod,
        packagedConfig: ing.packagedConfig,
      });
    }

    // --- Sample customer ---
    const customerRef = adminDb.collection("customers").doc("sample-customer");
    batch.set(customerRef, {
      name: "Pelanggan Umum",
      channel: "walk_in",
      phoneNumber: null,
      address: null,
      discountPerUnit: 0,
      notes: "",
      isActive: true,
      createdVia: "manual",
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      seeded: {
        variants: variants.length,
        products: products.length,
        ingredients: ingredients.length,
        customers: 1,
      },
    });
  } catch (err) {
    console.error("POST /api/seed error:", err);
    return NextResponse.json(
      { error: "Gagal seed data" },
      { status: 500 }
    );
  }
}
