import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";

// PATCH /api/variants/[id] — edit info varian ATAU stock opname
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = params;
  const body = await req.json();
  const { name, sortOrder, minStock, currentStock, adjustment, note } = body as {
    name?: string; sortOrder?: number; minStock?: number;  // edit info
    currentStock?: number; adjustment?: number; note?: string;  // stock opname
  };

  try {
    const ref = adminDb.doc(`variants/${id}`);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Varian tidak ditemukan" }, { status: 404 });

    // Edit info (name/sortOrder/minStock)
    if (name !== undefined) {
      if (!name.trim()) return NextResponse.json({ error: "Nama varian wajib diisi" }, { status: 400 });
      await ref.update({
        name: name.trim(),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(minStock !== undefined ? { minStock } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ id, name: name.trim() });
    }

    // Stock opname (currentStock / adjustment)
    if (currentStock === undefined && adjustment === undefined) {
      return NextResponse.json({ error: "Berikan name (edit) atau currentStock/adjustment (opname)" }, { status: 400 });
    }
    const prev = snap.data()?.currentStock ?? 0;
    const newStock = currentStock !== undefined
      ? Math.max(0, currentStock)
      : Math.max(0, prev + (adjustment ?? 0));
    await ref.update({ currentStock: newStock, lastOpnameAt: FieldValue.serverTimestamp(), lastOpnameNote: note ?? null });
    return NextResponse.json({ id, currentStock: newStock, previous: prev });

  } catch (err) {
    console.error("PATCH /api/variants/[id] error:", err);
    return NextResponse.json({ error: "Gagal update varian" }, { status: 500 });
  }
}

// DELETE /api/variants/[id] — hapus varian
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const ref = adminDb.doc(`variants/${params.id}`);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Varian tidak ditemukan" }, { status: 404 });
    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/variants/[id] error:", err);
    return NextResponse.json({ error: "Gagal menghapus varian" }, { status: 500 });
  }
}

// GET /api/variants/[id] — ambil satu varian
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const snap = await adminDb.doc(`variants/${params.id}`).get();
    if (!snap.exists) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
    const d = snap.data()!;
    return NextResponse.json({
      id: snap.id,
      name: d.name,
      currentStock: d.currentStock ?? 0,
      minStock: d.minStock ?? 10,
      sortOrder: d.sortOrder ?? 0,
    });
  } catch (err) {
    console.error("GET /api/variants/[id] error:", err);
    return NextResponse.json({ error: "Gagal mengambil varian" }, { status: 500 });
  }
}
