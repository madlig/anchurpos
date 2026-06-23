import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const snap = await adminDb.doc("settings/attendanceConfig").get();
    if (!snap.exists) {
      return NextResponse.json({
        whitelistedIps: [],
        lastDetectedIp: null,
        lastDetectedAt: null,
        updatedBy: null,
        updatedAt: null,
      });
    }

    const d = snap.data()!;
    return NextResponse.json({
      whitelistedIps: d.whitelistedIps ?? [],
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
