import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const [productsSnap, variantsSnap, stocksSnap] = await Promise.all([
      adminDb.collection("products").where("isActive", "==", true).get(),
      adminDb.collection("variants").orderBy("sortOrder").get(),
      adminDb.collection("productStocks").get(),
    ]);

    const products = productsSnap.docs.map((doc) => ({ id: doc.id, name: doc.data().name }));
    const variants = variantsSnap.docs.map((doc) => ({ id: doc.id, name: doc.data().name }));

    const stocksMap = new Map<string, number>();
    stocksSnap.docs.forEach((doc) => {
      stocksMap.set(doc.id, doc.data().currentStock ?? 0);
    });

    const results: { id: string; productId: string; productName: string; variantId: string; variantName: string; name: string; currentStock: number }[] = [];
    products.forEach((prod) => {
      variants.forEach((v) => {
        const stockId = `${prod.id}_${v.id}`;
        const currentStock = stocksMap.get(stockId) ?? 0;

        results.push({
          id: stockId,
          productId: prod.id,
          productName: prod.name,
          variantId: v.id,
          variantName: v.name,
          name: `${prod.name} - ${v.name}`,
          currentStock,
        });
      });
    });

    return NextResponse.json(results, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60"
      }
    });
  } catch (err) {
    console.error("GET /api/public/products/stocks error:", err);
    return NextResponse.json({ error: "Gagal mengambil stok produk" }, { status: 500 });
  }
}
