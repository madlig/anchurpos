import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import { ingredientSchema } from "@/lib/validations";

// PATCH /api/ingredients/[id] — edit bahan baku
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json();
  const parseResult = ingredientSchema.partial().safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Data tidak valid", details: parseResult.error.format() }, { status: 400 });
  }

  const { name, baseUnit, category, minStock, channels, unitAlternatives, defaultCostPerBaseUnit, price, netWeightGrams, opnameMethod } = parseResult.data;

  if (name !== undefined && !name.trim()) {
    return NextResponse.json({ error: "Nama bahan wajib diisi" }, { status: 400 });
  }
  if (baseUnit !== undefined && !baseUnit.trim()) {
    return NextResponse.json({ error: "Satuan wajib diisi" }, { status: 400 });
  }

  try {
    const ref = adminDb.collection("ingredients").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Bahan tidak ditemukan" }, { status: 404 });

    const updates: Record<string, any> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (name !== undefined) updates.name = name.trim();
    if (baseUnit !== undefined) updates.baseUnit = baseUnit.trim();
    if (category !== undefined) updates.category = category;
    if (minStock !== undefined) updates.minStock = minStock;
    if (channels !== undefined) updates.channels = channels;
    if (unitAlternatives !== undefined) updates.unitAlternatives = unitAlternatives;
    if (defaultCostPerBaseUnit !== undefined) {
      updates.defaultCostPerBaseUnit = defaultCostPerBaseUnit;
      updates.lastHppUpdateDate = new Date().toISOString();
    }
    if (price !== undefined) updates.price = price;
    if (netWeightGrams !== undefined) updates.netWeightGrams = netWeightGrams;
    if (opnameMethod !== undefined) updates.opnameMethod = opnameMethod;

    await ref.update(updates);

    return NextResponse.json({ id, name: name ? name.trim() : snap.data()?.name });
  } catch (err) {
    console.error("PATCH /api/ingredients/[id] error:", err);
    return NextResponse.json({ error: "Gagal mengubah bahan" }, { status: 500 });
  }
}

// DELETE /api/ingredients/[id] — hapus bahan baku
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const ref = adminDb.collection("ingredients").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Bahan tidak ditemukan" }, { status: 404 });

    // Referential Integrity Guard
    const recipeCheck = await adminDb.collection("recipes").where("ingredientId", "==", id).limit(1).get();
    if (!recipeCheck.empty) {
      return NextResponse.json({ error: "Tidak bisa dihapus karena bahan ini sedang dipakai di dalam Resep. Hapus atau ubah resep yang terkait terlebih dahulu." }, { status: 400 });
    }

    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/ingredients/[id] error:", err);
    return NextResponse.json({ error: "Gagal menghapus bahan" }, { status: 500 });
  }
}
