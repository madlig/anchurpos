import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import { employeeSchema } from "@/lib/validations";

const EMAIL_DOMAIN = "anchur.internal";

// GET /api/employees — daftar semua karyawan
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const snap = await adminDb.collection("users").get();
    const employees = snap.docs
      .map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name ?? "",
          username: d.username ?? d.email?.split("@")[0] ?? "",
          role: d.role ?? "crew",
          phone: d.phone ?? null,
          joinDate: d.joinDate ?? null,
          isActive: d.isActive !== false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(employees);
  } catch (err) {
    console.error("GET /api/employees error:", err);
    return NextResponse.json({ error: "Gagal mengambil data karyawan" }, { status: 500 });
  }
}

// POST /api/employees — tambah karyawan baru
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parseResult = employeeSchema.safeParse(body);
  
  if (!parseResult.success) {
    return NextResponse.json({ error: "Data tidak valid", details: parseResult.error.format() }, { status: 400 });
  }

  const { name, username, password, role, phone, joinDate } = parseResult.data;

  const uname = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
  const email = `${uname}@${EMAIL_DOMAIN}`;

  try {
    // Cek apakah username sudah dipakai
    const existing = await adminDb.collection("users").where("username", "==", uname).get();
    if (!existing.empty) return NextResponse.json({ error: "Username sudah digunakan" }, { status: 409 });

    // Buat di Firebase Auth
    const userRecord = await adminAuth.createUser({ email, password, displayName: name.trim() });

    // Set custom claim role
    await adminAuth.setCustomUserClaims(userRecord.uid, { role });

    // Simpan di Firestore
    await adminDb.collection("users").doc(userRecord.uid).set({
      name: name.trim(),
      username: uname,
      email,
      role,
      phone,
      joinDate,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id: userRecord.uid, name: name.trim(), username: uname, role }, { status: 201 });
  } catch (err: unknown) {
    const msg = (err as { code?: string })?.code === "auth/email-already-exists"
      ? "Username sudah digunakan"
      : "Gagal membuat akun karyawan";
    console.error("POST /api/employees error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
