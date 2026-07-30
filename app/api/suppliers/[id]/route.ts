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

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.code !== undefined) updates.code = String(body.code).trim();
    if (body.category !== undefined) updates.category = body.category;
    if (body.contactPerson !== undefined) updates.contactPerson = body.contactPerson ? String(body.contactPerson).trim() : null;
    if (body.phoneNumber !== undefined) updates.phoneNumber = body.phoneNumber ? String(body.phoneNumber).trim() : null;
    if (body.email !== undefined) updates.email = body.email ? String(body.email).trim() : null;
    if (body.address !== undefined) updates.address = body.address ? String(body.address).trim() : null;
    if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes).trim() : "";
    if (body.paymentTerms !== undefined) updates.paymentTerms = body.paymentTerms;

    await supplierRef.update(updates);
    return NextResponse.json({ id, ...updates });
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
