import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";

// PATCH /api/employees/[id] — edit info karyawan
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { name, role, phone, joinDate } = body as {
    name?: string; role?: string; phone?: string | null; joinDate?: string | null;
  };

  if (name !== undefined && !name.trim()) return NextResponse.json({ error: "Nama tidak boleh kosong" }, { status: 400 });

  try {
    const ref = adminDb.collection("users").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (name !== undefined) updates.name = name.trim();
    if (role !== undefined) updates.role = role;
    if (phone !== undefined) updates.phone = phone;
    if (joinDate !== undefined) updates.joinDate = joinDate;

    await ref.update(updates);

    // Update Firebase Auth jika ada perubahan nama atau role
    const authUpdates: Record<string, unknown> = {};
    if (name !== undefined) authUpdates.displayName = name.trim();
    if (Object.keys(authUpdates).length) await adminAuth.updateUser(id, authUpdates);
    if (role !== undefined) await adminAuth.setCustomUserClaims(id, { role });

    return NextResponse.json({ id, ...updates });
  } catch (err) {
    console.error("PATCH /api/employees/[id] error:", err);
    return NextResponse.json({ error: "Gagal mengubah data karyawan" }, { status: 500 });
  }
}

// DELETE /api/employees/[id] — nonaktifkan karyawan
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const ref = adminDb.collection("users").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });

    await ref.update({ isActive: false, updatedAt: FieldValue.serverTimestamp() });
    await adminAuth.updateUser(id, { disabled: true });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/employees/[id] error:", err);
    return NextResponse.json({ error: "Gagal menonaktifkan karyawan" }, { status: 500 });
  }
}

// GET /api/employees/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const snap = await adminDb.collection("users").doc(id).get();
    if (!snap.exists) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
    const d = snap.data()!;
    return NextResponse.json({ id: snap.id, name: d.name, username: d.username, role: d.role, phone: d.phone, isActive: d.isActive });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
