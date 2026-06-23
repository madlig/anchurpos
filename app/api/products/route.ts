import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import type { Product, PriceTier } from "@/types";

export async function GET() {
  try {
    const snap = await adminDb
      .collection("products")
      .where("isActive", "==", true)
      .orderBy("name")
      .get();

    const products: (Product & { priceTiers: PriceTier[] })[] = [];

    for (const doc of snap.docs) {
      const data = doc.data();
      const tiersSnap = await adminDb
        .collection("products")
        .doc(doc.id)
        .collection("priceTiers")
        .orderBy("minQty")
        .get();

      const priceTiers: PriceTier[] = tiersSnap.docs.map((t) => ({
        id: t.id,
        minQty: t.data().minQty,
        maxQty: t.data().maxQty ?? null,
        price: t.data().price,
      }));

      products.push({
        id: doc.id,
        code: data.code,
        name: data.name,
        description: data.description ?? "",
        packPerBatch: data.packPerBatch,
        isActive: data.isActive,
        createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
        updatedAt: data.updatedAt?.toDate?.().toISOString() ?? "",
        priceTiers,
      });
    }

    return NextResponse.json(products);
  } catch (err) {
    console.error("GET /api/products error:", err);
    return NextResponse.json(
      { error: "Gagal mengambil data produk" },
      { status: 500 }
    );
  }
}
