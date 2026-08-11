import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import { customerSchema } from "@/lib/validations";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json();
  const parseResult = customerSchema.partial().safeParse(body);
  
  if (!parseResult.success) {
    return NextResponse.json({ error: "Data tidak valid", details: parseResult.error.format() }, { status: 400 });
  }

  try {
    const ref = adminDb.collection("customers").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Pelanggan tidak ditemukan" }, { status: 404 });

    const updates = { ...parseResult.data };
    if (updates.name) {
      updates.name = updates.name.trim();
    }

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

