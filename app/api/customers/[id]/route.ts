import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json();

  try {
    const ref = adminDb.collection("customers").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Pelanggan tidak ditemukan" }, { status: 404 });

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.customerType !== undefined) updates.customerType = body.customerType;
    if (body.channel !== undefined) updates.channel = body.channel;
    if (body.phoneNumber !== undefined) updates.phoneNumber = body.phoneNumber;
    if (body.address !== undefined) updates.address = body.address;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.discountPerUnit !== undefined) updates.discountPerUnit = Number(body.discountPerUnit) || 0;
    if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);

    await ref.update(updates);
    return NextResponse.json({ id, ...updates });
  } catch (err) {
    console.error("PATCH /api/customers/[id] error:", err);
    return NextResponse.json({ error: "Gagal memperbarui pelanggan" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    await adminDb.collection("customers").doc(id).update({ isActive: false });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/customers/[id] error:", err);
    return NextResponse.json({ error: "Gagal menghapus pelanggan" }, { status: 500 });
  }
}

