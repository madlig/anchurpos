import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const targetItemId = searchParams.get("targetItemId");

    let query = adminDb.collection("prepackRecipes") as FirebaseFirestore.Query;
    if (targetItemId) {
      query = query.where("targetItemId", "==", targetItemId);
    }

    const snap = await query.get();
    const recipes = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(recipes);
  } catch (error) {
    console.error("GET /api/recipes/prepack error:", error);
    return NextResponse.json({ error: "Gagal mengambil resep pre-pack" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { targetItemId, items } = body as {
      targetItemId: string;
      items: Array<{ ingredientId: string; qtyPerPack: number; unit: string }>;
    };

    if (!targetItemId || !Array.isArray(items)) {
      return NextResponse.json({ error: "Data payload tidak valid" }, { status: 400 });
    }

    const batch = adminDb.batch();

    // 1. Hapus resep prepack lama untuk target item ini
    const oldSnap = await adminDb
      .collection("prepackRecipes")
      .where("targetItemId", "==", targetItemId)
      .get();

    oldSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // 2. Simpan resep prepack baru & hitung total HPP unit target
    let calculatedTargetHpp = 0;

    for (const item of items) {
      if (item.ingredientId && item.qtyPerPack > 0) {
        const ref = adminDb.collection("prepackRecipes").doc();
        batch.set(ref, {
          targetItemId,
          ingredientId: item.ingredientId,
          qtyPerPack: Number(item.qtyPerPack),
          unit: item.unit || "pcs",
          createdAt: new Date().toISOString(),
        });

        // Query HPP ingredient komponen
        const ingDoc = await adminDb.collection("ingredients").doc(item.ingredientId).get();
        if (ingDoc.exists) {
          const ingData = ingDoc.data();
          const baseCost = Number(ingData?.defaultCostPerBaseUnit || 0);
          calculatedTargetHpp += baseCost * Number(item.qtyPerPack);
        }
      }
    }

    // Update HPP modal dasar targetItemId jika calculatedTargetHpp > 0
    if (calculatedTargetHpp > 0) {
      const targetIngRef = adminDb.collection("ingredients").doc(targetItemId);
      batch.update(targetIngRef, { defaultCostPerBaseUnit: calculatedTargetHpp });
    }

    await batch.commit();
    return NextResponse.json({ message: "Resep pre-pack berhasil disimpan", calculatedTargetHpp });
  } catch (error) {
    console.error("POST /api/recipes/prepack error:", error);
    return NextResponse.json({ error: "Gagal menyimpan resep pre-pack" }, { status: 500 });
  }
}
