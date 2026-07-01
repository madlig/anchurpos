import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const body = await req.json();
    const { name, price, minStock } = body;

    const addOnRef = adminDb.collection("addOns").doc(id);
    const snap = await addOnRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Add-on tidak ditemukan" }, { status: 404 });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (price !== undefined) updates.price = Number(price);
    if (minStock !== undefined) updates.minStock = Number(minStock);

    await addOnRef.update(updates);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/addons/[id] error:", err);
    return NextResponse.json({ error: "Gagal memperbarui add-on" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const addOnRef = adminDb.collection("addOns").doc(id);
    await addOnRef.delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/addons/[id] error:", err);
    return NextResponse.json({ error: "Gagal menghapus add-on" }, { status: 500 });
  }
}
