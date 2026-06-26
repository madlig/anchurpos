import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["crew"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  const ip = getClientIp(req);

  try {
    const configSnap = await adminDb.doc("settings/attendanceConfig").get();
    const config = configSnap.data();
    const body = await req.json().catch(() => ({}));
    const clientSsid = body?.wifiSsid ?? "";
    const allowedSsid = config?.whitelistedSsid ?? "";
    const ssidValid = !allowedSsid || (clientSsid.trim() === allowedSsid.trim());

    const whitelist: string[] = config?.whitelistedIps ?? [];
    const ipValid = whitelist.includes(ip);

    if (!ipValid || !ssidValid) {
      await adminDb.doc("settings/attendanceConfig").set(
        { lastDetectedIp: ip, lastDetectedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );

      let errorMsg = "Lokasi absen tidak valid.";
      if (!ipValid && !ssidValid) {
        errorMsg = "IP dan Wi-Fi SSID tidak dikenali, hubungi Manager";
      } else if (!ipValid) {
        errorMsg = "IP tidak dikenali, hubungi Manager";
      } else {
        errorMsg = `SSID Wi-Fi "${clientSsid}" tidak sesuai, hubungi Manager`;
      }

      return NextResponse.json(
        { error: errorMsg },
        { status: 403 }
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const attendanceId = `${today}_${user.uid}`;
    const existingSnap = await adminDb.doc(`attendance/${attendanceId}`).get();

    if (existingSnap.exists) {
      const existing = existingSnap.data();
      if (!existing?.checkOut?.time) {
        return NextResponse.json(
          { error: "Sudah absen masuk hari ini, belum checkout" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Sudah absen masuk dan pulang hari ini" },
        { status: 400 }
      );
    }

    const userSnap = await adminDb.doc(`users/${user.uid}`).get();
    const userName = userSnap.data()?.name ?? "Crew";

    await adminDb.doc(`attendance/${attendanceId}`).set({
      date: today,
      employeeId: user.uid,
      employeeName: userName,
      checkIn: {
        time: new Date().toISOString(),
        ipAddress: ip,
        ipValid: true,
      },
      checkOut: null,
      totalHours: null,
      regularHours: null,
      overtimeHours: null,
      overtimeBlocks: null,
      overtimeBonus: null,
      status: "belum_lengkap",
      flaggedReason: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, attendanceId });
  } catch (err) {
    console.error("POST /api/attendance/check-in error:", err);
    return NextResponse.json({ error: "Gagal absen masuk" }, { status: 500 });
  }
}
