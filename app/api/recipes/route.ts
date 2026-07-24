import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const variantId = searchParams.get("variantId");

    if (!variantId) {
      return NextResponse.json({ error: "Parameter variantId wajib diisi" }, { status: 400 });
    }

    const snap = await adminDb
      .collection("recipes")
      .where("variantId", "==", variantId)
      .get();

    const recipes = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json(recipes);
  } catch (error) {
    console.error("GET /api/recipes error:", error);
    return NextResponse.json({ error: "Gagal mengambil data resep" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { variantId, productId, recipes } = body;

    if (!variantId || !productId || !Array.isArray(recipes)) {
      return NextResponse.json({ error: "Data payload tidak valid" }, { status: 400 });
    }

    const batch = adminDb.batch();

    // 1. Hapus semua resep lama untuk varian ini
    const oldSnap = await adminDb
      .collection("recipes")
      .where("variantId", "==", variantId)
      .get();

    oldSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 2. Simpan resep baru
    for (const item of recipes) {
      const docRef = adminDb.collection("recipes").doc();
      batch.set(docRef, {
        productId,
        variantId,
        ingredientId: item.ingredientId,
        qtyPerBatch: Number(item.qtyPerBatch) || 0,
        unit: item.unit || "gram"
      });
    }

    await batch.commit();

    return NextResponse.json({ success: true, message: "Resep berhasil disimpan" });
  } catch (error) {
    console.error("POST /api/recipes error:", error);
    return NextResponse.json({ error: "Gagal menyimpan resep" }, { status: 500 });
  }
}
