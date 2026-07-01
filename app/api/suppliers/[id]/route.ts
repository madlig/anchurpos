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
    const { name, contactPerson, phoneNumber } = body;

    const supplierRef = adminDb.collection("suppliers").doc(id);
    const snap = await supplierRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Supplier tidak ditemukan" }, { status: 404 });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (contactPerson !== undefined) updates.contactPerson = contactPerson.trim();
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber.trim();

    await supplierRef.update(updates);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/suppliers/[id] error:", err);
    return NextResponse.json({ error: "Gagal memperbarui supplier" }, { status: 500 });
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
    const supplierRef = adminDb.collection("suppliers").doc(id);
    await supplierRef.delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/suppliers/[id] error:", err);
    return NextResponse.json({ error: "Gagal menghapus supplier" }, { status: 500 });
  }
}
