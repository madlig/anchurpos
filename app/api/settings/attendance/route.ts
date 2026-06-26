import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const snap = await adminDb.doc("settings/attendanceConfig").get();
    if (!snap.exists) {
      return NextResponse.json({
        whitelistedIps: [],
        whitelistedSsid: null,
        lastDetectedIp: null,
        lastDetectedAt: null,
        updatedBy: null,
        updatedAt: null,
      });
    }

    const d = snap.data()!;
    return NextResponse.json({
      whitelistedIps: d.whitelistedIps ?? [],
      whitelistedSsid: d.whitelistedSsid ?? null,
      lastDetectedIp: d.lastDetectedIp ?? null,
      lastDetectedAt: d.lastDetectedAt?.toDate?.().toISOString() ?? d.lastDetectedAt ?? null,
      updatedBy: d.updatedBy ?? null,
      updatedAt: d.updatedAt?.toDate?.().toISOString() ?? d.updatedAt ?? null,
    });
  } catch (err) {
    console.error("GET /api/settings/attendance error:", err);
    return NextResponse.json({ error: "Gagal mengambil pengaturan absen" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  try {
    const { whitelistedSsid } = await req.json();
    const configRef = adminDb.doc("settings/attendanceConfig");

    await configRef.set(
      {
        whitelistedSsid: whitelistedSsid !== undefined ? String(whitelistedSsid).trim() : null,
        updatedBy: user.uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("POST /api/settings/attendance error:", err);
    return NextResponse.json({ error: "Gagal menyimpan pengaturan" }, { status: 500 });
  }
}
