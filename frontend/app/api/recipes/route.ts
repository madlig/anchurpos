import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import type { Recipe } from "@/types";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");

  try {
    let query = adminDb.collection("recipes") as FirebaseFirestore.Query;

    if (productId) {
      query = query.where("productId", "==", productId);
    }

    const snap = await query.get();

    const recipes: Recipe[] = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        productId: data.productId,
        variantId: data.variantId,
        ingredientId: data.ingredientId,
        qtyPerBatch: data.qtyPerBatch,
        unit: data.unit,
      };
    });

    return NextResponse.json(recipes);
  } catch (err) {
    console.error("GET /api/recipes error:", err);
    return NextResponse.json(
      { error: "Gagal mengambil data resep" },
      { status: 500 }
    );
  }
}
