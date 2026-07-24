import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import type { Variant } from "@/types";

export async function GET() {
  try {
    const snap = await adminDb
      .collection("variants")
      .orderBy("sortOrder")
      .get();

    const variants: Variant[] = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        productId: data.productId ?? "",
        name: data.name,
        isProductionVariant: data.isProductionVariant ?? true,
        sortOrder: data.sortOrder ?? 0,
        // Public endpoint should not expose internal minStock
        currentStock: 0, 
        minStock: 0,
      };
    });

    return NextResponse.json(variants, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300"
      }
    });
  } catch (err) {
    console.error("GET /api/public/variants error:", err);
    return NextResponse.json({ error: "Gagal mengambil data varian" }, { status: 500 });
  }
}
