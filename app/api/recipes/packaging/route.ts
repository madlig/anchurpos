import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    let query = adminDb.collection("packagingRecipes") as FirebaseFirestore.Query;
    if (productId) {
      query = query.where("productId", "==", productId);
    }

    const snap = await query.get();
    const recipes = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(recipes);
  } catch (error) {
    console.error("GET /api/recipes/packaging error:", error);
    return NextResponse.json({ error: "Gagal mengambil resep kemasan" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { productId, items } = body as {
      productId: string;
      items: Array<{ ingredientId: string; qtyPerPack: number; unit: string }>;
    };

    if (!productId || !Array.isArray(items)) {
      return NextResponse.json({ error: "Data payload tidak valid" }, { status: 400 });
    }

    const batch = adminDb.batch();

    // 1. Hapus resep kemasan lama untuk produk ini
    const oldSnap = await adminDb
      .collection("packagingRecipes")
      .where("productId", "==", productId)
      .get();

    oldSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // 2. Simpan resep kemasan baru
    for (const item of items) {
      if (item.ingredientId && item.qtyPerPack > 0) {
        const newRef = adminDb.collection("packagingRecipes").doc();
        batch.set(newRef, {
          productId,
          ingredientId: item.ingredientId,
          qtyPerPack: item.qtyPerPack,
          unit: item.unit || "pcs",
          createdAt: new Date(),
        });
      }
    }

    await batch.commit();
    return NextResponse.json({ success: true, message: "Resep kemasan berhasil disimpan" });
  } catch (error) {
    console.error("POST /api/recipes/packaging error:", error);
    return NextResponse.json({ error: "Gagal menyimpan resep kemasan" }, { status: 500 });
  }
}
