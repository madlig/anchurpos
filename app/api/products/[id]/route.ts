import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import { productSchema } from "@/lib/validations";

// PATCH /api/products/[id] — edit produk & price tiers
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json();
  const parseResult = productSchema.partial().safeParse(body);
  
  if (!parseResult.success) {
    return NextResponse.json({ error: "Data tidak valid", details: parseResult.error.format() }, { status: 400 });
  }

  const { name, code, description, packPerBatch, priceTiers, channels } = parseResult.data;

  if (name !== undefined && !name.trim()) {
    return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
  }
  if (code !== undefined && !code.trim()) {
    return NextResponse.json({ error: "Kode wajib diisi" }, { status: 400 });
  }

  try {
    const ref = adminDb.collection("products").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });

    const updates: any = { updatedAt: FieldValue.serverTimestamp() };
    if (name !== undefined) updates.name = name.trim();
    if (code !== undefined) updates.code = code.trim().toUpperCase();
    if (description !== undefined) updates.description = description;
    if (packPerBatch !== undefined) updates.packPerBatch = packPerBatch;
    if (channels !== undefined) updates.channels = channels;

    await ref.update(updates);

    // Update price tiers: delete all then re-create
    if (priceTiers !== undefined) {
      const tiersRef = ref.collection("priceTiers");
      const existingTiers = await tiersRef.get();
      const batch = adminDb.batch();
      existingTiers.docs.forEach(d => batch.delete(d.ref));
      priceTiers.forEach((tier, i) => {
        batch.set(tiersRef.doc(`t${i + 1}`), {
          minQty: tier.minQty,
          maxQty: tier.maxQty ?? null,
          price: tier.price,
        });
      });
      await batch.commit();
    }

    return NextResponse.json({ id, name: name ? name.trim() : "Updated" });
  } catch (err) {
    console.error("PATCH /api/products/[id] error:", err);
    return NextResponse.json({ error: "Gagal mengubah produk" }, { status: 500 });
  }
}

// DELETE /api/products/[id] — non-aktifkan produk (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const ref = adminDb.collection("products").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });

    await ref.update({ isActive: false, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/products/[id] error:", err);
    return NextResponse.json({ error: "Gagal menghapus produk" }, { status: 500 });
  }
}

// GET /api/products/[id] — ambil satu produk beserta price tiers
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ref = adminDb.collection("products").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
    const d = snap.data()!;

    const tiersSnap = await ref.collection("priceTiers").orderBy("minQty").get();
    const priceTiers = tiersSnap.docs.map(t => ({ ...t.data() }));

    return NextResponse.json({ id: snap.id, ...d, priceTiers });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
