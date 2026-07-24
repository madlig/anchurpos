import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";

// PATCH /api/variants/[id] — edit info varian ATAU stock opname
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json();
  const { name, sortOrder, minStock, freeSauceAllowance, currentStock, adjustment, note } = body as {
    name?: string; sortOrder?: number; minStock?: number; freeSauceAllowance?: number; // edit info
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
        ...(freeSauceAllowance !== undefined ? { freeSauceAllowance } : { freeSauceAllowance: FieldValue.delete() }),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ id, name: name.trim() });
    }

    // Stock opname (currentStock / adjustment)
    if (currentStock === undefined && adjustment === undefined) {
      return NextResponse.json({ error: "Berikan name (edit) atau currentStock/adjustment (opname)" }, { status: 400 });
    }

    let prev = 0;
    let newStock = 0;

    await adminDb.runTransaction(async (tx) => {
      const variantSnap = await tx.get(ref);
      if (!variantSnap.exists) throw new Error("Varian tidak ditemukan");

      prev = variantSnap.data()?.currentStock ?? 0;
      newStock = currentStock !== undefined
        ? Math.max(0, currentStock)
        : Math.max(0, prev + (adjustment ?? 0));

      tx.update(ref, {
        currentStock: newStock,
        lastOpnameAt: FieldValue.serverTimestamp(),
        lastOpnameNote: note ?? null,
      });

      const movementRef = adminDb.collection("stockMovements").doc();
      tx.set(movementRef, {
        ingredientId: id,
        changeAmount: newStock - prev,
        newStockAfter: newStock,
        sourceType: "opname",
        sourceId: null,
        note: note || "Koreksi manual stok varian",
        createdBy: auth.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ id, currentStock: newStock, previous: prev });

  } catch (err) {
    console.error("PATCH /api/variants/[id] error:", err);
    return NextResponse.json({ error: "Gagal update varian" }, { status: 500 });
  }
}

// DELETE /api/variants/[id] — hapus varian
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const ref = adminDb.doc(`variants/${id}`);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Varian tidak ditemukan" }, { status: 404 });

    // Guard: Cek apakah dipakai di resep
    const recipeCheck = await adminDb.collection("recipes").where("variantId", "==", id).limit(1).get();
    if (!recipeCheck.empty) {
      return NextResponse.json({ error: "Tidak bisa dihapus karena Varian ini masih terikat dengan sebuah Resep. Hapus atau ubah Resep terkait terlebih dahulu." }, { status: 400 });
    }

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const snap = await adminDb.doc(`variants/${id}`).get();
    if (!snap.exists) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
    const d = snap.data()!;
    return NextResponse.json({
      id: snap.id,
      name: d.name,
      currentStock: d.currentStock ?? 0,
      minStock: d.minStock ?? 10,
      sortOrder: d.sortOrder ?? 0,
      freeSauceAllowance: d.freeSauceAllowance,
    });
  } catch (err) {
    console.error("GET /api/variants/[id] error:", err);
    return NextResponse.json({ error: "Gagal mengambil varian" }, { status: 500 });
  }
}
