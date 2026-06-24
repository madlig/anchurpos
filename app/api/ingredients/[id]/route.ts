import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";

// PATCH /api/ingredients/[id] — edit bahan baku
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = params;
  const body = await req.json();
  const { name, baseUnit, category, minStock } = body as {
    name?: string; baseUnit?: string; category?: string; minStock?: number;
  };

  if (!name?.trim() || !baseUnit?.trim()) {
    return NextResponse.json({ error: "Nama dan satuan wajib diisi" }, { status: 400 });
  }

  try {
    const ref = adminDb.collection("ingredients").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Bahan tidak ditemukan" }, { status: 404 });

    await ref.update({
      name: name.trim(),
      baseUnit: baseUnit.trim(),
      category: category ?? "bahan_baku",
      minStock: minStock ?? 0,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id, name: name.trim() });
  } catch (err) {
    console.error("PATCH /api/ingredients/[id] error:", err);
    return NextResponse.json({ error: "Gagal mengubah bahan" }, { status: 500 });
  }
}

// DELETE /api/ingredients/[id] — hapus bahan baku
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const ref = adminDb.collection("ingredients").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Bahan tidak ditemukan" }, { status: 404 });

    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/ingredients/[id] error:", err);
    return NextResponse.json({ error: "Gagal menghapus bahan" }, { status: 500 });
  }
}
