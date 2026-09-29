import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import { employeeUpdateSchema } from "@/lib/validations";

// PATCH /api/employees/[id] — edit info karyawan & reaktivasi
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;
  const currentUser = auth;

  const body = await req.json();
  const parseResult = employeeUpdateSchema.safeParse(body);
  
  if (!parseResult.success) {
    return NextResponse.json({ error: "Data tidak valid", details: parseResult.error.format() }, { status: 400 });
  }

  const { name, role, phone, joinDate, dailyWage, isActive } = parseResult.data;

  try {
    const ref = adminDb.collection("users").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });

    const targetUser = snap.data();

    // Proteksi Hirarki: Manager tidak boleh mengubah data Owner
    if (targetUser?.role === "owner" && currentUser.role !== "owner") {
      return NextResponse.json({ error: "Akses ditolak. Hanya Owner yang dapat mengubah data akun Owner." }, { status: 403 });
    }

    // Proteksi: Manager tidak boleh menetapkan role Owner
    if (role === "owner" && currentUser.role !== "owner") {
      return NextResponse.json({ error: "Hanya Owner yang dapat menetapkan hak akses Owner." }, { status: 403 });
    }

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (name !== undefined) updates.name = name.trim();
    if (role !== undefined) updates.role = role;
    if (phone !== undefined) updates.phone = phone;
    if (joinDate !== undefined) updates.joinDate = joinDate;
    if (dailyWage !== undefined) updates.dailyWage = dailyWage;
    if (isActive !== undefined) updates.isActive = isActive;

    await ref.update(updates);

    // Update Firebase Auth jika ada perubahan nama, status aktif, atau role
    const authUpdates: Record<string, unknown> = {};
    if (name !== undefined) authUpdates.displayName = name.trim();
    if (isActive !== undefined) authUpdates.disabled = !isActive;
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
  const currentUser = auth;

  // Proteksi: Tidak boleh menonaktifkan akun sendiri
  if (id === currentUser.uid) {
    return NextResponse.json({ error: "Anda tidak dapat menonaktifkan akun Anda sendiri." }, { status: 400 });
  }

  try {
    const ref = adminDb.collection("users").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });

    const targetUser = snap.data();

    // Proteksi: Akun Owner tidak boleh dinonaktifkan
    if (targetUser?.role === "owner") {
      return NextResponse.json({ error: "Akun Owner tidak dapat dinonaktifkan." }, { status: 403 });
    }

    // Proteksi: Manager tidak boleh menonaktifkan Manager lain
    if (currentUser.role === "manager" && targetUser?.role === "manager") {
      return NextResponse.json({ error: "Hanya Owner yang dapat menonaktifkan sesama Manager." }, { status: 403 });
    }

    const isPermanent = req.nextUrl.searchParams.get("permanent") === "true";

    if (isPermanent) {
      // Cek apakah karyawan memiliki riwayat absensi
      const attSnap = await adminDb.collection("attendances").where("employeeId", "==", id).limit(1).get();
      if (!attSnap.empty) {
        return NextResponse.json(
          { error: "Karyawan ini sudah memiliki riwayat absensi. Tidak dapat dihapus permanen demi integritas data laporan. Gunakan status Nonaktif." },
          { status: 400 }
        );
      }

      // Cek apakah karyawan memiliki riwayat payroll
      const paySnap = await adminDb.collection("payrolls").where("employeeId", "==", id).limit(1).get();
      if (!paySnap.empty) {
        return NextResponse.json(
          { error: "Karyawan ini sudah memiliki riwayat slip gaji/payroll. Tidak dapat dihapus permanen." },
          { status: 400 }
        );
      }

      // Hapus dokumen Firestore
      await ref.delete();

      // Hapus dari Firebase Auth
      try {
        await adminAuth.deleteUser(id);
      } catch (authErr) {
        console.warn("User Auth might already be deleted or not found:", authErr);
      }

      return NextResponse.json({ success: true, permanent: true });
    }

    await ref.update({ isActive: false, updatedAt: FieldValue.serverTimestamp() });
    await adminAuth.updateUser(id, { disabled: true });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/employees/[id] error:", err);
    return NextResponse.json({ error: "Gagal memproses penghapusan karyawan" }, { status: 500 });
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
    return NextResponse.json({ id: snap.id, name: d.name, username: d.username, role: d.role, phone: d.phone, joinDate: d.joinDate, dailyWage: d.dailyWage ?? 60000, isActive: d.isActive });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
