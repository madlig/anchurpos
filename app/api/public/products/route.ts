import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import type { Product, PriceTier } from "@/types";

export async function GET() {
  try {
    const [snap, allTiersSnap] = await Promise.all([
      adminDb.collection("products").where("isActive", "==", true).get(),
      adminDb.collectionGroup("priceTiers").get()
    ]);

    // Group price tiers by productId
    const tiersByProduct = new Map<string, PriceTier[]>();
    for (const tDoc of allTiersSnap.docs) {
      const productId = tDoc.ref.parent.parent?.id;
      if (!productId) continue;
      
      const tData = tDoc.data();
      const tier = {
        id: tDoc.id,
        minQty: tData.minQty,
        maxQty: tData.maxQty ?? null,
        price: tData.price,
      };
      
      if (!tiersByProduct.has(productId)) {
        tiersByProduct.set(productId, []);
      }
      tiersByProduct.get(productId)!.push(tier);
    }

    const products: (Product & { priceTiers: PriceTier[] })[] = snap.docs.map((doc) => {
      const data = doc.data();
      const priceTiers = (tiersByProduct.get(doc.id) || []).sort((a, b) => a.minQty - b.minQty);
      
      return {
        id: doc.id,
        name: data.name,
        code: data.code || "",
        description: data.description ?? "",
        packPerBatch: data.packPerBatch ?? 1,
        isActive: data.isActive ?? true,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        channels: data.channels ?? [],
        priceTiers,
      } as unknown as (Product & { priceTiers: PriceTier[] });
    });

    return NextResponse.json(products.sort((a, b) => a.name.localeCompare(b.name)), {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300"
      }
    });
  } catch (err) {
    console.error("GET /api/public/products error:", err);
    return NextResponse.json(
      { error: "Gagal mengambil data produk" },
      { status: 500 }
    );
  }
}
