import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  const { ip } = (await req.json()) as { ip: string };
  if (!ip || !ip.trim()) {
    return NextResponse.json({ error: "IP address wajib diisi" }, { status: 400 });
  }

  try {
    const configRef = adminDb.doc("settings/attendanceConfig");
    const snap = await configRef.get();
    const current = snap.data();
    const existing: string[] = current?.whitelistedIps ?? [];

    if (existing.includes(ip.trim())) {
      return NextResponse.json({ error: "IP sudah ada di whitelist" }, { status: 400 });
    }

    await configRef.set(
      {
        whitelistedIps: [...existing, ip.trim()],
        lastDetectedIp: null,
        lastDetectedAt: null,
        updatedBy: user.uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/settings/attendance/whitelist error:", err);
    return NextResponse.json({ error: "Gagal menambah IP" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  const { ip } = (await req.json()) as { ip: string };
  if (!ip) {
    return NextResponse.json({ error: "IP address wajib diisi" }, { status: 400 });
  }

  try {
    const configRef = adminDb.doc("settings/attendanceConfig");
    const snap = await configRef.get();
    const current = snap.data();
    const existing: string[] = current?.whitelistedIps ?? [];

    await configRef.set(
      {
        whitelistedIps: existing.filter((item) => item !== ip.trim()),
        updatedBy: user.uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/settings/attendance/whitelist error:", err);
    return NextResponse.json({ error: "Gagal menghapus IP" }, { status: 500 });
  }
}
