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
      storeLat: d.storeLat ?? null,
      storeLng: d.storeLng ?? null,
      radiusMeter: d.radiusMeter ?? null,
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
    const { whitelistedSsid, storeLat, storeLng, radiusMeter } = await req.json();
    const configRef = adminDb.doc("settings/attendanceConfig");

    const updates: Record<string, any> = {
      updatedBy: user.uid,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (whitelistedSsid !== undefined) {
      updates.whitelistedSsid = whitelistedSsid !== null ? String(whitelistedSsid).trim() : null;
    }
    if (storeLat !== undefined) {
      updates.storeLat = storeLat !== null ? Number(storeLat) : null;
    }
    if (storeLng !== undefined) {
      updates.storeLng = storeLng !== null ? Number(storeLng) : null;
    }
    if (radiusMeter !== undefined) {
      updates.radiusMeter = radiusMeter !== null ? Number(radiusMeter) : null;
    }

    await configRef.set(updates, { merge: true });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("POST /api/settings/attendance error:", err);
    return NextResponse.json({ error: "Gagal menyimpan pengaturan" }, { status: 500 });
  }
}
